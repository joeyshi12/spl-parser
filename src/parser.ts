import { AggregationFunction, LimitAndOffset, PlotFunction, Token, TokenType, SPLQuery, PlotClause, ColumnMetadata, WhereCondition, BarPlotCall, PointPlotCall } from './types';
import { Lexer } from './lexer';
import { SPLError } from './exceptions';

/**
 * Parser for SPL queries
 */
export class Parser {
    private _lexer: Lexer;
    private _currentToken: Token;

    constructor(lexer: Lexer) {
        this._lexer = lexer;
        this._currentToken = this._lexer.nextToken();
    }

   /**
    * Parses the SPL query into a syntax tree
    * @returns AST of the SPL query
    */
    public parse(): SPLQuery {
        const plotClause = this._consumePlotClauseOptional();
        const selectColumns = this._consumeSelectClause();
        const whereCondition = this._consumeWhereClauseOptional();
        const groupKey = this._consumeGroupByClauseOptional();
        const limitAndOffset = this._consumeLimitAndOffsetClauseOptional();
        this._consumeToken("EOF");
        return {
            plotClause,
            selectColumns,
            whereCondition,
            groupKey,
            limitAndOffset
        };
    }

    private _consumePlotClauseOptional(): PlotClause | undefined {
        if (this._currentToken.value !== "PLOT") {
            return undefined;
        }
        this._consumeToken("KEYWORD", "PLOT");
        const plotFunction = <PlotFunction>this._consumeToken("PLOT_FUNCTION").value;
        this._consumeToken("LPAREN");
        const plotClause = this._consumePlotArgs(plotFunction);
        this._consumeToken("RPAREN");
        return plotClause;
    }

    private _consumePlotArgs(plotFunction: PlotFunction): PlotClause {
        switch (plotFunction) {
            case "BAR":
                const categoriesColumn = this._consumeColumn();
                this._consumeToken("COMMA");
                const valuesColumn = this._consumeColumn();
                return <BarPlotCall> {
                    plotFunction,
                    categoriesColumn,
                    valuesColumn
                };
            case "LINE":
            case "SCATTER":
                const xColumn = this._consumeColumn();
                this._consumeToken("COMMA");
                const yColumn = this._consumeColumn();
                return <PointPlotCall> {
                    plotFunction,
                    xColumn,
                    yColumn
                }
            default:
                throw new SPLError(`Invalid plot type ${plotFunction}`);
        }
    }

    private _consumeSelectClause(): ColumnMetadata[] {
        const selectColumns = [];
        do {
            selectColumns.push(this._consumeColumn());
            this._consumeToken("COMMA");
        } while (this._currentToken.type !== "IDENTIFIER")
        return selectColumns;
    }

    private _consumeColumn(): ColumnMetadata {
        let column: string | undefined = undefined;
        let aggregationFunction: AggregationFunction | undefined = undefined;

        if (this._currentToken.type === "AGGREGATION_FUNCTION") {
            aggregationFunction = <AggregationFunction>this._consumeToken("AGGREGATION_FUNCTION").value;
            this._consumeToken("LPAREN");
            if (aggregationFunction !== "COUNT") {
                column = this._consumeToken("IDENTIFIER").value;
            }
            this._consumeToken("RPAREN");
        } else {
            column = this._consumeToken("IDENTIFIER").value;
        }

        let displayName = undefined;
        if (this._currentToken.value === "AS") {
            this._consumeToken("KEYWORD");
            displayName = this._consumeToken("IDENTIFIER").value;
        }

        return { column, displayName, aggregationFunction }
    }

    private _consumeWhereClauseOptional(): WhereCondition | undefined {
        if (this._currentToken.value !== "WHERE") {
            return undefined;
        }
        this._consumeToken("KEYWORD");
        return this._consumeCondition();
    }

    private _consumeCondition(): WhereCondition {
        const filters: WhereCondition[] = [];

        while (true) {
            const innerConditions = [this._consumeConditionGroup()];
            while (this._currentToken.value === "AND") {
                this._consumeToken("LOGICAL_OPERATOR");
                innerConditions.push(this._consumeConditionGroup());
            }
            const innerCondition = innerConditions.length === 1
                ? innerConditions[0]
                : { and: innerConditions };
            filters.push(innerCondition);
            if (this._currentToken.value !== "OR") {
                break;
            }
            this._currentToken = this._lexer.nextToken();
        }

        if (filters.length === 1) {
            return filters[0];
        }

        return { or: filters };
    }

    private _consumeConditionGroup(): WhereCondition {
        if (this._currentToken.type === "IDENTIFIER") {
            return this._consumeComparison();
        }
        this._consumeToken("LPAREN");
        const condition = this._consumeCondition();
        this._consumeToken("RPAREN");
        return condition;
    }

    private _consumeComparison(): WhereCondition {
        const key = this._consumeToken("IDENTIFIER").value;
        const comparisonOperator = this._consumeToken("COMPARISON_OPERATOR").value;

        let value;
        switch (comparisonOperator) {
            case ">":
                value = Number(this._consumeToken("NUMBER").value);
                return { gt: { key, value } };
            case ">=":
                value = Number(this._consumeToken("NUMBER").value);
                return { gte: { key, value } };
            case "<":
                value = Number(this._consumeToken("NUMBER").value);
                return { lt: { key, value } };
            case "<=":
                value = Number(this._consumeToken("NUMBER").value);
                return { lte: { key, value } };
            case "=":
                return { eq: { key, value: this._consumeComparisonValue() } };
            case "!=":
                return { neq: { key, value: this._consumeComparisonValue() } };
            default:
                throw new SPLError(`Invalid comparison operator ${comparisonOperator}`)
        }
    }

    private _consumeGroupByClauseOptional(): string | undefined {
        if (this._currentToken.value !== "GROUPBY") {
            return undefined;
        }
        this._consumeToken("KEYWORD");
        return this._consumeToken("IDENTIFIER").value;
    }

    private _consumeLimitAndOffsetClauseOptional(): LimitAndOffset | undefined {
        if (this._currentToken.value !== "LIMIT") {
            return undefined;
        }
        this._consumeToken("KEYWORD");
        const limit = Number(this._consumeToken("NUMBER").value);
        if (this._currentToken.value.valueOf() !== "OFFSET") {
            return { limit, offset: 0 };
        }
        this._consumeToken("KEYWORD");
        const offset = Number(this._consumeToken("NUMBER").value);
        return { limit, offset };
    }

    private _consumeToken(tokenType: TokenType, value?: string): Token {
        const token = this._currentToken;
        if (token.type === tokenType && (!value || token.value === value)) {
            this._currentToken = this._lexer.nextToken();
            return token;
        } else {
            throw new SPLError(`Unexpected token ${JSON.stringify(this._currentToken)} at position ${this._lexer.currentPosition}`)
        }
    }

    private _consumeComparisonValue(): string | number | null {
        const token = this._currentToken;
        this._currentToken = this._lexer.nextToken();
        switch (token.type) {
            case "STRING":
                return token.value;
            case "NUMBER":
                return Number(token.value);
            case "NULL":
                return null;
            default:
                throw new SPLError("Equal comparison allowed only for string, number, and null");
        }
    }
}

