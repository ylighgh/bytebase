package mysql

// Framework code is generated by the generator.

import (
	"context"
	"fmt"

	"github.com/antlr4-go/antlr/v4"
	"github.com/pkg/errors"

	mysql "github.com/bytebase/mysql-parser"

	"github.com/bytebase/bytebase/backend/common"
	storepb "github.com/bytebase/bytebase/backend/generated-go/store"
	"github.com/bytebase/bytebase/backend/plugin/advisor"
	mysqlparser "github.com/bytebase/bytebase/backend/plugin/parser/mysql"
)

var (
	_ advisor.Advisor = (*ColumnCommentConventionAdvisor)(nil)
)

func init() {
	advisor.Register(storepb.Engine_MYSQL, advisor.MySQLColumnCommentConvention, &ColumnCommentConventionAdvisor{})
	advisor.Register(storepb.Engine_MARIADB, advisor.MySQLColumnCommentConvention, &ColumnCommentConventionAdvisor{})
	advisor.Register(storepb.Engine_OCEANBASE, advisor.MySQLColumnCommentConvention, &ColumnCommentConventionAdvisor{})
}

// ColumnCommentConventionAdvisor is the advisor checking for column comment convention.
type ColumnCommentConventionAdvisor struct {
}

// Check checks for column comment convention.
func (*ColumnCommentConventionAdvisor) Check(_ context.Context, checkCtx advisor.Context) ([]*storepb.Advice, error) {
	stmtList, ok := checkCtx.AST.([]*mysqlparser.ParseResult)
	if !ok {
		return nil, errors.Errorf("failed to convert to mysql parse result")
	}

	level, err := advisor.NewStatusBySQLReviewRuleLevel(checkCtx.Rule.Level)
	if err != nil {
		return nil, err
	}
	payload, err := advisor.UnmarshalCommentConventionRulePayload(checkCtx.Rule.Payload)
	if err != nil {
		return nil, err
	}
	checker := &columnCommentConventionChecker{
		level:                level,
		title:                string(checkCtx.Rule.Type),
		payload:              payload,
		classificationConfig: checkCtx.ClassificationConfig,
	}

	for _, stmt := range stmtList {
		checker.baseLine = stmt.BaseLine
		antlr.ParseTreeWalkerDefault.Walk(checker, stmt.Tree)
	}

	return checker.adviceList, nil
}

type columnCommentConventionChecker struct {
	*mysql.BaseMySQLParserListener

	baseLine             int
	adviceList           []*storepb.Advice
	level                storepb.Advice_Status
	title                string
	payload              *advisor.CommentConventionRulePayload
	classificationConfig *storepb.DataClassificationSetting_DataClassificationConfig
}

func (checker *columnCommentConventionChecker) EnterCreateTable(ctx *mysql.CreateTableContext) {
	if !mysqlparser.IsTopMySQLRule(&ctx.BaseParserRuleContext) {
		return
	}
	if ctx.TableName() == nil {
		return
	}
	if ctx.TableElementList() == nil {
		return
	}

	_, tableName := mysqlparser.NormalizeMySQLTableName(ctx.TableName())
	for _, tableElement := range ctx.TableElementList().AllTableElement() {
		if tableElement == nil {
			continue
		}
		if tableElement.ColumnDefinition() == nil {
			continue
		}

		_, _, columnName := mysqlparser.NormalizeMySQLColumnName(tableElement.ColumnDefinition().ColumnName())
		if tableElement.ColumnDefinition().FieldDefinition() == nil {
			continue
		}
		checker.checkFieldDefinition(tableName, columnName, tableElement.ColumnDefinition().FieldDefinition())
	}
}

func (checker *columnCommentConventionChecker) EnterAlterTable(ctx *mysql.AlterTableContext) {
	if !mysqlparser.IsTopMySQLRule(&ctx.BaseParserRuleContext) {
		return
	}
	if ctx.AlterTableActions() == nil {
		return
	}
	if ctx.AlterTableActions().AlterCommandList() == nil {
		return
	}
	if ctx.AlterTableActions().AlterCommandList().AlterList() == nil {
		return
	}

	_, tableName := mysqlparser.NormalizeMySQLTableRef(ctx.TableRef())
	// alter table add column, change column, modify column.
	for _, item := range ctx.AlterTableActions().AlterCommandList().AlterList().AllAlterListItem() {
		if item == nil {
			continue
		}

		var columnName string
		switch {
		// add column
		case item.ADD_SYMBOL() != nil:
			switch {
			case item.Identifier() != nil && item.FieldDefinition() != nil:
				columnName := mysqlparser.NormalizeMySQLIdentifier(item.Identifier())
				checker.checkFieldDefinition(tableName, columnName, item.FieldDefinition())
			case item.OPEN_PAR_SYMBOL() != nil && item.TableElementList() != nil:
				for _, tableElement := range item.TableElementList().AllTableElement() {
					if tableElement.ColumnDefinition() == nil || tableElement.ColumnDefinition().ColumnName() == nil || tableElement.ColumnDefinition().FieldDefinition() == nil {
						continue
					}
					_, _, columnName := mysqlparser.NormalizeMySQLColumnName(tableElement.ColumnDefinition().ColumnName())
					checker.checkFieldDefinition(tableName, columnName, tableElement.ColumnDefinition().FieldDefinition())
				}
			}
		// modify column
		case item.MODIFY_SYMBOL() != nil && item.ColumnInternalRef() != nil && item.FieldDefinition() != nil:
			columnName = mysqlparser.NormalizeMySQLColumnInternalRef(item.ColumnInternalRef())
			checker.checkFieldDefinition(tableName, columnName, item.FieldDefinition())
		// change column
		case item.CHANGE_SYMBOL() != nil && item.ColumnInternalRef() != nil && item.Identifier() != nil && item.FieldDefinition() != nil:
			columnName = mysqlparser.NormalizeMySQLIdentifier(item.Identifier())
			checker.checkFieldDefinition(tableName, columnName, item.FieldDefinition())
		}
	}
}

func (checker *columnCommentConventionChecker) checkFieldDefinition(tableName, columnName string, ctx mysql.IFieldDefinitionContext) {
	comment := ""
	for _, attribute := range ctx.AllColumnAttribute() {
		if attribute == nil || attribute.GetValue() == nil {
			continue
		}
		if attribute.GetValue().GetTokenType() != mysql.MySQLParserCOMMENT_SYMBOL {
			continue
		}
		if attribute.TextLiteral() == nil {
			continue
		}
		comment = mysqlparser.NormalizeMySQLTextLiteral(attribute.TextLiteral())
		if checker.payload.MaxLength >= 0 && len(comment) > checker.payload.MaxLength {
			checker.adviceList = append(checker.adviceList, &storepb.Advice{
				Status:        checker.level,
				Code:          advisor.CommentTooLong.Int32(),
				Title:         checker.title,
				Content:       fmt.Sprintf("The length of column `%s`.`%s` comment should be within %d characters", tableName, columnName, checker.payload.MaxLength),
				StartPosition: common.ConvertANTLRLineToPosition(checker.baseLine + ctx.GetStart().GetLine()),
			})
		}

		if checker.payload.RequiredClassification {
			if classification, _ := common.GetClassificationAndUserComment(comment, checker.classificationConfig); classification == "" {
				checker.adviceList = append(checker.adviceList, &storepb.Advice{
					Status:        checker.level,
					Code:          advisor.CommentMissingClassification.Int32(),
					Title:         checker.title,
					Content:       fmt.Sprintf("Column `%s`.`%s` comment requires classification", tableName, columnName),
					StartPosition: common.ConvertANTLRLineToPosition(checker.baseLine + ctx.GetStart().GetLine()),
				})
			}
		}

		break
	}

	if len(comment) == 0 && checker.payload.Required {
		checker.adviceList = append(checker.adviceList, &storepb.Advice{
			Status:        checker.level,
			Code:          advisor.CommentEmpty.Int32(),
			Title:         checker.title,
			Content:       fmt.Sprintf("Column `%s`.`%s` requires comments", tableName, columnName),
			StartPosition: common.ConvertANTLRLineToPosition(checker.baseLine + ctx.GetStart().GetLine()),
		})
	}
}
