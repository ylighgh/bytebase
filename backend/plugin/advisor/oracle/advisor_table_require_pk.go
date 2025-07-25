// Package oracle is the advisor for oracle database.
package oracle

import (
	"context"
	"fmt"

	"github.com/antlr4-go/antlr/v4"
	parser "github.com/bytebase/plsql-parser"
	"github.com/pkg/errors"

	"github.com/bytebase/bytebase/backend/common"
	storepb "github.com/bytebase/bytebase/backend/generated-go/store"
	"github.com/bytebase/bytebase/backend/plugin/advisor"
)

var (
	_ advisor.Advisor = (*TableRequirePKAdvisor)(nil)
)

func init() {
	advisor.Register(storepb.Engine_ORACLE, advisor.OracleTableRequirePK, &TableRequirePKAdvisor{})
	advisor.Register(storepb.Engine_DM, advisor.OracleTableRequirePK, &TableRequirePKAdvisor{})
	advisor.Register(storepb.Engine_OCEANBASE_ORACLE, advisor.OracleTableRequirePK, &TableRequirePKAdvisor{})
}

// TableRequirePKAdvisor is the advisor checking table requires PK.
type TableRequirePKAdvisor struct {
}

// Check checks table requires PK.
func (*TableRequirePKAdvisor) Check(_ context.Context, checkCtx advisor.Context) ([]*storepb.Advice, error) {
	tree, ok := checkCtx.AST.(antlr.Tree)
	if !ok {
		return nil, errors.Errorf("failed to convert to Tree")
	}

	level, err := advisor.NewStatusBySQLReviewRuleLevel(checkCtx.Rule.Level)
	if err != nil {
		return nil, err
	}

	listener := &TableRequirePKListener{
		level:           level,
		title:           string(checkCtx.Rule.Type),
		currentDatabase: checkCtx.CurrentDatabase,
		tableWitPK:      make(map[string]bool),
		tableLine:       make(map[string]int),
	}

	antlr.ParseTreeWalkerDefault.Walk(listener, tree)

	return listener.generateAdvice()
}

// TableRequirePKListener is the listener used to collect table requires PK.
type TableRequirePKListener struct {
	*parser.BasePlSqlParserListener

	level           storepb.Advice_Status
	title           string
	currentDatabase string
	tableName       string
	tableWitPK      map[string]bool
	tableLine       map[string]int
}

func (l *TableRequirePKListener) generateAdvice() ([]*storepb.Advice, error) {
	advice := []*storepb.Advice{}
	for tableName, hasPK := range l.tableWitPK {
		if !hasPK {
			advice = append(advice, &storepb.Advice{
				Status:        l.level,
				Code:          advisor.TableNoPK.Int32(),
				Title:         l.title,
				Content:       fmt.Sprintf("Table %s requires PRIMARY KEY.", normalizeIdentifierName(tableName)),
				StartPosition: common.ConvertANTLRLineToPosition(l.tableLine[tableName]),
			})
		}
	}

	return advice, nil
}

// EnterCreate_table is called when production create_table is entered.
func (l *TableRequirePKListener) EnterCreate_table(ctx *parser.Create_tableContext) {
	schemaName := l.currentDatabase
	if ctx.Schema_name() != nil {
		schemaName = normalizeIdentifier(ctx.Schema_name(), l.currentDatabase)
	}

	l.tableName = fmt.Sprintf("%s.%s", schemaName, normalizeIdentifier(ctx.Table_name(), l.currentDatabase))
	l.tableWitPK[l.tableName] = false
	l.tableLine[l.tableName] = ctx.GetStop().GetLine()
}

// ExitCreate_table is called when production create_table is exited.
func (l *TableRequirePKListener) ExitCreate_table(_ *parser.Create_tableContext) {
	l.tableName = ""
}

// EnterInline_constraint is called when production inline_constraint is entered.
func (l *TableRequirePKListener) EnterInline_constraint(ctx *parser.Inline_constraintContext) {
	if ctx.PRIMARY() != nil {
		if _, exists := l.tableWitPK[l.tableName]; exists {
			l.tableWitPK[l.tableName] = true
		}
	}
}

// EnterConstraint_clauses is called when production constraint_clauses is entered.
func (l *TableRequirePKListener) EnterConstraint_clauses(ctx *parser.Constraint_clausesContext) {
	if ctx.PRIMARY() != nil {
		if _, exists := l.tableWitPK[l.tableName]; exists {
			l.tableWitPK[l.tableName] = true
		}
	}
}

// EnterOut_of_line_constraint is called when production out_of_line_constraint is entered.
func (l *TableRequirePKListener) EnterOut_of_line_constraint(ctx *parser.Out_of_line_constraintContext) {
	if ctx.PRIMARY() != nil {
		if _, exists := l.tableWitPK[l.tableName]; exists {
			l.tableWitPK[l.tableName] = true
		}
	}
}

// EnterAlter_table is called when production alter_table is entered.
func (l *TableRequirePKListener) EnterAlter_table(ctx *parser.Alter_tableContext) {
	l.tableName = normalizeIdentifier(ctx.Tableview_name(), l.currentDatabase)
}

// ExitAlter_table is called when production alter_table is exited.
func (l *TableRequirePKListener) ExitAlter_table(_ *parser.Alter_tableContext) {
	l.tableName = ""
}

// EnterDrop_table is called when production drop_table is entered.
func (l *TableRequirePKListener) EnterDrop_table(ctx *parser.Drop_tableContext) {
	tableName := normalizeIdentifier(ctx.Tableview_name(), l.currentDatabase)
	if _, exists := l.tableWitPK[tableName]; !exists {
		return
	}
	delete(l.tableWitPK, tableName)
}

// EnterDrop_primary_key_or_unique_or_generic_clause is called when production drop_primary_key_or_unique_or_generic_clause is entered.
func (l *TableRequirePKListener) EnterDrop_primary_key_or_unique_or_generic_clause(ctx *parser.Drop_primary_key_or_unique_or_generic_clauseContext) {
	if _, exists := l.tableWitPK[l.tableName]; exists && ctx.PRIMARY() != nil {
		l.tableWitPK[l.tableName] = false
		l.tableLine[l.tableName] = ctx.GetStop().GetLine()
	}
}
