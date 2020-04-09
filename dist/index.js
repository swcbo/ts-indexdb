"use strict";
/*
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-08 21:24:32
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-09 11:17:55
 */
Object.defineProperty(exports, "__esModule", { value: true });
const TsIndexDb_1 = require("./TsIndexDb");
exports.init = ({ dbName, version = new Date().getTime(), tables = [] }) => {
    const db = TsIndexDb_1.TsIndexDb.getInstance({
        dbName,
        version,
        tables
    });
    return db.open_db();
};
exports.getInstance = () => TsIndexDb_1.TsIndexDb.getInstance();
