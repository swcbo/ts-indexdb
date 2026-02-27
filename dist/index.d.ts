import { TsIndexDb, IIndexDb, IndexDbError } from './TsIndexDb';
export { TsIndexDb, IndexDbError };
export type { IIndexDb, DbTable, DbIndex, DbOperate, PageQueryOptions, PageQueryResult, MapCondition, CountConditionType } from './TsIndexDb';
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
export declare const init: ({ dbName, version, tables }: IIndexDb) => Promise<TsIndexDb>;
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
export declare const initMany: (dbList: IIndexDb[]) => Promise<TsIndexDb[]>;
/**
 * 获取已初始化的数据库实例（单库场景）
 * @throws {IndexDbError} 若数据库尚未初始化则抛出错误
 *
 * @example
 * // 在 init() 之后调用
 * const db = getInstance()
 * await db.queryAll({ tableName: 'users' })
 */
export declare const getInstance: () => TsIndexDb;
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
export declare const getInstanceByName: (dbName: string) => TsIndexDb;
/**
 * 列出当前所有已初始化的数据库实例名称
 * @returns 数据库名称数组
 */
export declare const getInstanceNames: () => string[];
//# sourceMappingURL=index.d.ts.map