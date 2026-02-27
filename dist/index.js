"use strict";
/*
 * @Description: ts-indexdb 入口文件
 * @Author: 小白
 * @Date: 2020-04-08 21:24:32
 * @LastEditors: Kilo
 * @LastEditTime: 2026-02-27
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstanceNames = exports.getInstanceByName = exports.getInstance = exports.initMany = exports.init = exports.IndexDbError = exports.TsIndexDb = void 0;
const TsIndexDb_1 = require("./TsIndexDb");
Object.defineProperty(exports, "TsIndexDb", { enumerable: true, get: function () { return TsIndexDb_1.TsIndexDb; } });
Object.defineProperty(exports, "IndexDbError", { enumerable: true, get: function () { return TsIndexDb_1.IndexDbError; } });
/**
 * 初始化并打开一个数据库（单实例，按 dbName 区分）
 * @param param0 数据库配置
 * @returns 打开完成的 TsIndexDb 实例
 *
 * @example
 * const db = await init({
 *   dbName: 'myApp',
 *   version: 1,
 *   tables: [
 *     {
 *       tableName: 'users',
 *       option: { keyPath: 'id', autoIncrement: true },
 *       indexs: [{ key: 'name' }, { key: 'email', option: { unique: true } }]
 *     }
 *   ]
 * })
 */
const init = ({ dbName, version = 1, tables = [] }) => {
    const db = TsIndexDb_1.TsIndexDb.getInstance({ dbName, version, tables });
    return db.open_db();
};
exports.init = init;
/**
 * 同时初始化并打开多个数据库
 * @param dbList 数据库配置数组
 * @returns 所有数据库实例数组（与传入顺序对应）
 *
 * @example
 * const [userDb, logDb] = await initMany([
 *   { dbName: 'userStore', version: 1, tables: [...] },
 *   { dbName: 'logStore',  version: 1, tables: [...] }
 * ])
 */
const initMany = (dbList) => {
    return Promise.all(dbList.map(config => {
        const db = TsIndexDb_1.TsIndexDb.getInstance(config);
        return db.open_db();
    }));
};
exports.initMany = initMany;
/**
 * 获取已初始化的数据库实例
 * - 单库场景：不传参数，自动返回唯一已初始化的实例
 * - 多库场景：传入 dbName 指定获取哪个库的实例
 * @param dbName 数据库名称（可选；单库时可省略）
 * @throws {IndexDbError} 若数据库尚未初始化则抛出错误
 *
 * @example
 * // 单库：在 init() 之后调用
 * const db = getInstance()
 * // 多库：在 initMany() 之后调用
 * const db = getInstance('userStore')
 */
const getInstance = (dbName) => {
    const names = TsIndexDb_1.TsIndexDb.getInstanceNames();
    if (dbName) {
        return TsIndexDb_1.TsIndexDb.getExistingInstance(dbName);
    }
    // 单库场景：自动返回唯一实例
    if (names.length === 1) {
        return TsIndexDb_1.TsIndexDb.getExistingInstance(names[0]);
    }
    // 无实例或多实例时抛出清晰的错误
    if (names.length === 0) {
        throw new TsIndexDb_1.IndexDbError('尚未初始化任何数据库，请先调用 init()。');
    }
    throw new TsIndexDb_1.IndexDbError(`存在多个数据库实例 [${names.join(', ')}]，请通过 getInstance(dbName) 指定要获取哪个。`);
};
exports.getInstance = getInstance;
/**
 * 按名称获取已初始化的数据库实例（多库场景）
 * @param dbName 数据库名称
 * @throws {IndexDbError} 若指定数据库尚未初始化则抛出错误
 *
 * @example
 * // 在 initMany() 之后调用
 * const userDb = getInstanceByName('userStore')
 * const logDb  = getInstanceByName('logStore')
 */
const getInstanceByName = (dbName) => TsIndexDb_1.TsIndexDb.getExistingInstance(dbName);
exports.getInstanceByName = getInstanceByName;
/**
 * 列出当前所有已初始化的数据库实例名称
 * @returns 数据库名称数组
 */
const getInstanceNames = () => TsIndexDb_1.TsIndexDb.getInstanceNames();
exports.getInstanceNames = getInstanceNames;
//# sourceMappingURL=index.js.map