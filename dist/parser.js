"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const exceptions_1 = require("./exceptions");
/**
 * Parser for SPL queries
 */
class Parser {
    constructor(lexer) {
        this._lexer = lexer;
        this._currentToken = this._lexer.nextToken();
    }
    /**
     * Parses the SPL query into a syntax tree
     * @returns AST of the SPL query
     */
    parse() {
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
    _consumePlotClauseOptional() {
        if (this._currentToken.value !== "PLOT") {
            return undefined;
        }
        this._consumeToken("KEYWORD", "PLOT");
        const plotFunction = this._consumeToken("PLOT_FUNCTION").value;
        this._consumeToken("LPAREN");
        const plotClause = this._consumePlotArgs(plotFunction);
        this._consumeToken("RPAREN");
        return plotClause;
    }
    _consumePlotArgs(plotFunction) {
        switch (plotFunction) {
            case "BAR":
                const categoriesToken = this._consumeToken("IDENTIFIER");
                this._consumeToken("COMMA");
                const valuesToken = this._consumeToken("IDENTIFIER");
                return {
                    plotFunction,
                    categoriesIdentifier: categoriesToken.value,
                    valuesIdentifier: valuesToken.value
                };
            case "LINE":
            case "SCATTER":
                const xToken = this._consumeToken("IDENTIFIER");
                this._consumeToken("COMMA");
                const yToken = this._consumeToken("IDENTIFIER");
                return {
                    plotFunction,
                    xIdentifier: xToken.value,
                    yIdentifier: yToken.value
                };
            default:
                throw new exceptions_1.SPLError(`Invalid plot type ${plotFunction}`);
        }
    }
    _consumeSelectClause() {
        this._consumeToken("KEYWORD", "SELECT");
        const selectColumns = [];
        do {
            selectColumns.push(this._consumeColumn());
            this._consumeToken("COMMA");
        } while (this._currentToken.type !== "IDENTIFIER");
        return selectColumns;
    }
    _consumeColumn() {
        let column = undefined;
        let aggregationFunction = undefined;
        if (this._currentToken.type === "AGGREGATION_FUNCTION") {
            aggregationFunction = this._consumeToken("AGGREGATION_FUNCTION").value;
            this._consumeToken("LPAREN");
            if (aggregationFunction !== "COUNT") {
                column = this._consumeToken("IDENTIFIER").value;
            }
            this._consumeToken("RPAREN");
        }
        else {
            column = this._consumeToken("IDENTIFIER").value;
        }
        let identifier = undefined;
        if (this._currentToken.value === "AS") {
            this._consumeToken("KEYWORD");
            identifier = this._consumeToken("IDENTIFIER").value;
        }
        if (!identifier) {
            if (aggregationFunction) {
                identifier = `${aggregationFunction}(${column !== null && column !== void 0 ? column : ""})`;
            }
            else {
                identifier = column;
            }
        }
        return { identifier, column, aggregationFunction };
    }
    _consumeWhereClauseOptional() {
        if (this._currentToken.value !== "WHERE") {
            return undefined;
        }
        this._consumeToken("KEYWORD");
        return this._consumeCondition();
    }
    _consumeCondition() {
        const filters = [];
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
    _consumeConditionGroup() {
        if (this._currentToken.type === "IDENTIFIER") {
            return this._consumeComparison();
        }
        this._consumeToken("LPAREN");
        const condition = this._consumeCondition();
        this._consumeToken("RPAREN");
        return condition;
    }
    _consumeComparison() {
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
                throw new exceptions_1.SPLError(`Invalid comparison operator ${comparisonOperator}`);
        }
    }
    _consumeGroupByClauseOptional() {
        if (this._currentToken.value !== "GROUPBY") {
            return undefined;
        }
        this._consumeToken("KEYWORD");
        return this._consumeToken("IDENTIFIER").value;
    }
    _consumeLimitAndOffsetClauseOptional() {
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
    _consumeToken(tokenType, value) {
        const token = this._currentToken;
        if (token.type === tokenType && (!value || token.value === value)) {
            this._currentToken = this._lexer.nextToken();
            return token;
        }
        else {
            throw new exceptions_1.SPLError(`Unexpected token ${JSON.stringify(this._currentToken)} at position ${this._lexer.currentPosition}`);
        }
    }
    _consumeComparisonValue() {
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
                throw new exceptions_1.SPLError("Equal comparison allowed only for string, number, and null");
        }
    }
}
exports.Parser = Parser;
