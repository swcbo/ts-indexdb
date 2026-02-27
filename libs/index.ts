/*
 * @Description: ts-indexdb 入口文件
 * @Author: 小白
 * @Date: 2020-04-08 21:24:32
 * @LastEditors: Kilo
 * @LastEditTime: 2026-02-27
 */

import { TsIndexDb, IIndexDb, IndexDbError } from './TsIndexDb'

export { TsIndexDb, IndexDbError }
export type { IIndexDb, DbTable, DbIndex, DbOperate, PageQueryOptions, PageQueryResult, MapCondition, CountConditionType } from './TsIndexDb'

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
export const init = ({ dbName, version = 1, tables = [] }: IIndexDb): Promise<TsIndexDb> => {
    const db = TsIndexDb.getInstance({ dbName, version, tables })
    return db.open_db()
}

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
export const initMany = (dbList: IIndexDb[]): Promise<TsIndexDb[]> => {
    return Promise.all(
        dbList.map(config => {
            const db = TsIndexDb.getInstance(config)
            return db.open_db()
        })
    )
}

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
export const getInstance = (dbName?: string): TsIndexDb => {
    const names = TsIndexDb.getInstanceNames()
    if (dbName) {
        return TsIndexDb.getExistingInstance(dbName)
    }
    // 单库场景：自动返回唯一实例
    if (names.length === 1) {
        return TsIndexDb.getExistingInstance(names[0])
    }
    // 无实例或多实例时抛出清晰的错误
    if (names.length === 0) {
        throw new IndexDbError('尚未初始化任何数据库，请先调用 init()。')
    }
    throw new IndexDbError(
        `存在多个数据库实例 [${names.join(', ')}]，请通过 getInstance(dbName) 指定要获取哪个。`
    )
}

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
export const getInstanceByName = (dbName: string): TsIndexDb =>
    TsIndexDb.getExistingInstance(dbName)

/**
 * 列出当前所有已初始化的数据库实例名称
 * @returns 数据库名称数组
 */
export const getInstanceNames = (): string[] => TsIndexDb.getInstanceNames()
