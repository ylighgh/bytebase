package mysql

import (
	"context"
	"fmt"

	"github.com/antlr4-go/antlr/v4"
	mysql "github.com/bytebase/mysql-parser"
	"github.com/pkg/errors"

	"github.com/bytebase/bytebase/backend/common"
	storepb "github.com/bytebase/bytebase/backend/generated-go/store"
	"github.com/bytebase/bytebase/backend/plugin/advisor"
	mysqlparser "github.com/bytebase/bytebase/backend/plugin/parser/mysql"
)

var (
	_ advisor.Advisor = (*WhereRequirementAdvisor)(nil)
)

func init() {
	advisor.Register(storepb.Engine_MYSQL, advisor.MySQLWhereRequirement, &WhereRequirementAdvisor{})
	advisor.Register(storepb.Engine_MARIADB, advisor.MySQLWhereRequirement, &WhereRequirementAdvisor{})
	advisor.Register(storepb.Engine_OCEANBASE, advisor.MySQLWhereRequirement, &WhereRequirementAdvisor{})
}

// WhereRequirementAdvisor is the advisor checking for the WHERE clause requirement.
type WhereRequirementAdvisor struct {
}

// Check checks for the WHERE clause requirement.
func (*WhereRequirementAdvisor) Check(_ context.Context, checkCtx advisor.Context) ([]*storepb.Advice, error) {
	root, ok := checkCtx.AST.([]*mysqlparser.ParseResult)
	if !ok {
		return nil, errors.Errorf("failed to convert to StmtNode")
	}

	level, err := advisor.NewStatusBySQLReviewRuleLevel(checkCtx.Rule.Level)
	if err != nil {
		return nil, err
	}
	checker := &whereRequirementChecker{
		level: level,
		title: string(checkCtx.Rule.Type),
	}
	for _, stmtNode := range root {
		checker.baseLine = stmtNode.BaseLine
		antlr.ParseTreeWalkerDefault.Walk(checker, stmtNode.Tree)
	}

	return checker.adviceList, nil
}

type whereRequirementChecker struct {
	*mysql.BaseMySQLParserListener

	baseLine   int
	adviceList []*storepb.Advice
	level      storepb.Advice_Status
	title      string
	text       string
}

func (checker *whereRequirementChecker) EnterQuery(ctx *mysql.QueryContext) {
	checker.text = ctx.GetParser().GetTokenStream().GetTextFromRuleContext(ctx)
}

// EnterDeleteStatement is called when production deleteStatement is entered.
func (checker *whereRequirementChecker) EnterDeleteStatement(ctx *mysql.DeleteStatementContext) {
	if !mysqlparser.IsTopMySQLRule(&ctx.BaseParserRuleContext) {
		return
	}
	if ctx.WhereClause() == nil || ctx.WhereClause().WHERE_SYMBOL() == nil {
		checker.handleWhereClause(ctx.GetStart().GetLine())
	}
}

// EnterUpdateStatement is called when production updateStatement is entered.
func (checker *whereRequirementChecker) EnterUpdateStatement(ctx *mysql.UpdateStatementContext) {
	if !mysqlparser.IsTopMySQLRule(&ctx.BaseParserRuleContext) {
		return
	}
	if ctx.WhereClause() == nil || ctx.WhereClause().WHERE_SYMBOL() == nil {
		checker.handleWhereClause(ctx.GetStart().GetLine())
	}
}

func (checker *whereRequirementChecker) EnterQuerySpecification(ctx *mysql.QuerySpecificationContext) {
	// Allow SELECT queries without a FROM clause to proceed, e.g. SELECT 1.
	if ctx.FromClause() == nil {
		return
	}
	if ctx.WhereClause() == nil || ctx.WhereClause().WHERE_SYMBOL() == nil {
		checker.handleWhereClause(ctx.GetStart().GetLine())
	}
}

func (checker *whereRequirementChecker) handleWhereClause(lineNumber int) {
	checker.adviceList = append(checker.adviceList, &storepb.Advice{
		Status:        checker.level,
		Code:          advisor.StatementNoWhere.Int32(),
		Title:         checker.title,
		Content:       fmt.Sprintf("\"%s\" requires WHERE clause", checker.text),
		StartPosition: common.ConvertANTLRLineToPosition(checker.baseLine + lineNumber),
	})
}
