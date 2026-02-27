<!--
 * @Description: ts-indexdb README
 * @Author: 小白
 * @Date: 2020-04-07 20:48:03
 * @LastEditors: Kilo
 * @LastEditTime: 2026-02-27
-->
# ts-indexdb

<p align="center">
  <a href="https://npmjs.com/package/ts-indexdb"><img src="https://img.shields.io/npm/v/ts-indexdb.svg?logo=npm" alt="npm package"></a>
  <a href="https://bundlephobia.com/package/ts-indexdb@latest"><img src="https://img.shields.io/bundlephobia/min/ts-indexdb.svg?logo=typescript" alt="size"></a>
</p>

TypeScript 封装的 IndexedDB 操作库，将浏览器原生回调式 API 转换为 Promise / async-await，支持泛型、多数据库实例、分页查询和事务批处理。

## 特性

- **Promise 化**：全部 CRUD 操作返回 `Promise`，支持 `async/await`
- **泛型支持**：TypeScript 类型安全，IDE 自动补全
- **多数据库实例**：可同时操作多个不同数据库，按 `dbName` 隔离
- **分页查询**：内置 `queryByPage` 支持偏移分页和游标方向
- **批量删除**：`delete_by_primaryKeys` 单次事务批量删除多条记录
- **事务批处理**：`transaction` 方法在单个事务中原子执行多操作
- **内存安全**：任务队列设最大长度（200），防止连接前大量入队导致内存泄漏
- **错误类型**：专用 `IndexDbError` 类，便于精准捕获

## 安装

```sh
npm install ts-indexdb
# 或
yarn add ts-indexdb
```

## 快速开始

### 初始化数据库

```ts
import { init, getInstance } from 'ts-indexdb'

// 定义数据类型
type User = {
  id?: number
  name: string
  email: string
  createdAt: number
}

// 初始化（页面加载时执行一次）
await init({
  dbName: 'myApp',         // 数据库名称
  version: 1,              // 版本号（升级结构时递增）
  tables: [
    {
      tableName: 'users',
      option: { keyPath: 'id', autoIncrement: true },
      indexs: [
        { key: 'name' },
        { key: 'email', option: { unique: true } },
        { key: 'createdAt' }
      ]
    }
  ]
})

// 之后任意处获取实例
const db = getInstance()
```

### 多数据库场景

```ts
import { initMany, getInstanceByName, getInstanceNames } from 'ts-indexdb'

const [userDb, logDb] = await initMany([
  { dbName: 'userStore', version: 1, tables: [/* ... */] },
  { dbName: 'logStore',  version: 1, tables: [/* ... */] }
])

// 按名称获取
const userDb2 = getInstanceByName('userStore')

// 查看所有已初始化数据库
console.log(getInstanceNames()) // ['userStore', 'logStore']
```

---

## API 文档

### 数据库管理

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `open_db()` | 打开数据库 | — | `Promise<TsIndexDb>` |
| `close_db()` | 关闭连接并销毁实例 | — | `Promise<void>` |
| `delete_db(name)` | 删除整个数据库 | `name: string` | `Promise<Event>` |
| `delete_table(tableName)` | 清空表数据（保留结构） | `tableName: string` | `Promise<void>` |

### 查询操作

| 方法 | 说明 | 参数 |
|------|------|------|
| `queryAll<T>({ tableName })` | 查询表所有数据 | `tableName` |
| `query<T>({ tableName, condition })` | 条件过滤查询（全表遍历） | `tableName`, `condition: (item: T) => boolean` |
| `queryByPage<T>(options)` | 分页查询 | 见下方 |
| `query_by_keyValue<T>({ tableName, key, value })` | 按索引字段精确查单条 | `tableName`, `key`, `value` |
| `query_by_primaryKey<T>({ tableName, value })` | 按主键查单条 | `tableName`, `value` |
| `count<T>({ tableName, key, countCondition })` | 统计满足范围条件的记录数 | `tableName`, `key`, `countCondition` |

#### `queryByPage` 参数

```ts
interface PageQueryOptions<T> {
  tableName: string
  page: number          // 从 1 开始
  pageSize: number
  condition?: (data: T) => boolean   // 可选过滤条件
  direction?: IDBCursorDirection     // 'next' | 'prev'，默认 'next'
}
```

#### `count` 的 `countCondition` 参数

```ts
// key = z
{ type: 'equal', rangeValue: [z] }
// key ≥ x
{ type: 'gt', rangeValue: [x] }
// key > x
{ type: 'gt', rangeValue: [x, x, true] }
// key ≤ y
{ type: 'lt', rangeValue: [y] }
// key < y
{ type: 'lt', rangeValue: [y, y, true] }
// key ≥ x && key ≤ y
{ type: 'between', rangeValue: [x, y] }
// key > x && key < y
{ type: 'between', rangeValue: [x, y, true, true] }
```

### 更新操作

| 方法 | 说明 |
|------|------|
| `update<T>({ tableName, condition, handle })` | 遍历满足条件的记录并更新 |
| `update_by_primaryKey<T>({ tableName, value, handle })` | 按主键更新单条 |

`handle` 函数接收当前记录对象，必须**返回**修改后的对象：

```ts
await db.update<User>({
  tableName: 'users',
  condition: item => item.id === 8,
  handle: item => ({ ...item, name: '新名字' })
})
```

### 插入操作

```ts
// 插入单条
await db.insert<User>({
  tableName: 'users',
  data: { name: '张三', email: 'zhang@example.com', createdAt: Date.now() }
})

// 批量插入（单事务，原子提交）
await db.insert<User>({
  tableName: 'users',
  data: [
    { name: '李四', email: 'li@example.com', createdAt: Date.now() },
    { name: '王五', email: 'wang@example.com', createdAt: Date.now() }
  ]
})
```

### 删除操作

| 方法 | 说明 |
|------|------|
| `delete<T>({ tableName, condition })` | 条件批量删除，返回已删除的记录数组 |
| `delete_by_primaryKey<T>({ tableName, value })` | 按主键删除单条 |
| `delete_by_primaryKeys({ tableName, values })` | 按主键数组批量删除（单事务） |

```ts
// 批量删除多条（单事务原子执行）
await db.delete_by_primaryKeys({
  tableName: 'users',
  values: [1, 2, 3, 4]
})
```

### 事务批处理

在单个事务中原子执行多个读/写操作，任一操作失败则全部回滚：

```ts
const results = await db.transaction<User>(
  'users',
  'readwrite',
  (store) => [
    store.get(1),
    store.get(2),
    store.put({ id: 3, name: '新记录', email: 'new@example.com', createdAt: Date.now() })
  ]
)
// results[0] = 主键1的记录, results[1] = 主键2的记录
```

---

## 完整使用示例

```ts
import { init, getInstance, getInstanceByName, initMany, IndexDbError } from 'ts-indexdb'

type Book = { id?: number; title: string; author: string; year: number }

async function main() {
  // ——— 初始化 ———
  await init({
    dbName: 'library',
    version: 1,
    tables: [{
      tableName: 'books',
      option: { keyPath: 'id', autoIncrement: true },
      indexs: [
        { key: 'title' },
        { key: 'author' },
        { key: 'year' }
      ]
    }]
  })

  const db = getInstance()

  // ——— 插入 ———
  await db.insert<Book>({
    tableName: 'books',
    data: [
      { title: '深入理解计算机系统', author: 'Randal E. Bryant', year: 2015 },
      { title: 'JavaScript高级程序设计', author: 'Nicholas C. Zakas', year: 2020 },
      { title: 'Clean Code', author: 'Robert C. Martin', year: 2008 }
    ]
  })

  // ——— 查询所有 ———
  const allBooks = await db.queryAll<Book>({ tableName: 'books' })
  console.log('全部书籍:', allBooks)

  // ——— 条件查询 ———
  const modernBooks = await db.query<Book>({
    tableName: 'books',
    condition: book => book.year >= 2015
  })
  console.log('2015年及以后:', modernBooks)

  // ——— 分页查询 ———
  const page1 = await db.queryByPage<Book>({
    tableName: 'books',
    page: 1,
    pageSize: 2
  })
  console.log('第1页:', page1.list, '是否有更多:', page1.hasMore)

  // ——— 按索引查询 ———
  const book = await db.query_by_keyValue<Book>({
    tableName: 'books',
    key: 'author',
    value: 'Robert C. Martin'
  })
  console.log('按作者查询:', book)

  // ——— 统计 ———
  const count = await db.count<Book>({
    tableName: 'books',
    key: 'year',
    countCondition: { type: 'between', rangeValue: [2010, 2025] }
  })
  console.log('2010-2025年书籍数量:', count)

  // ——— 更新 ———
  await db.update_by_primaryKey<Book>({
    tableName: 'books',
    value: 1,
    handle: book => ({ ...book, title: '深入理解计算机系统（第3版）' })
  })

  // ——— 删除 ———
  await db.delete_by_primaryKey<Book>({ tableName: 'books', value: 3 })

  // ——— 事务批处理 ———
  await db.transaction<void>(
    'books',
    'readwrite',
    (store) => [
      store.put({ id: 10, title: '设计模式', author: 'GoF', year: 1994 }),
      store.put({ id: 11, title: '重构', author: 'Martin Fowler', year: 2018 })
    ]
  )

  // ——— 错误处理 ———
  try {
    await db.query_by_primaryKey<Book>({ tableName: 'nonexistent', value: 1 })
  } catch (e) {
    if (e instanceof IndexDbError) {
      console.error('IndexDb 操作错误:', e.message)
    }
  }

  // ——— 关闭数据库 ———
  await db.close_db()
}

main()
```

---

## 注意事项

- **单库场景**：调用 `init()` 一次后，通过 `getInstance()` 获取实例
- **多库场景**：调用 `initMany()` 后，通过 `getInstanceByName(dbName)` 按名称获取
- **版本升级**：修改 `tables` 配置后需递增 `version` 号，否则表结构不会更新
- **数据加密**：IndexedDB 本身不加密，敏感数据请在应用层自行加密后存储
- **浏览器支持**：IndexedDB 支持所有现代浏览器（Chrome 24+、Firefox 16+、Safari 10+）

## 更新日志

### v1.0.0
- **[修复]** `insert` 批量插入改为事务 `oncomplete` 后 resolve，避免数据丢失
- **[修复]** `getInstance()` 未初始化时抛出明确错误，而非返回 `null`
- **[修复]** `close_db()` 未开启时正确 `reject` 而非 `resolve`
- **[修复]** `cursor_success` 改为私有方法并消除 `any` 类型
- **[修复]** `.npmignore` 路径从 `lib/` 改为正确的 `libs/`
- **[修复]** 任务队列增加最大长度（200），防止内存泄漏
- **[新增]** 多数据库实例支持（`initMany`、`getInstanceByName`）
- **[新增]** 分页查询 `queryByPage`，支持过滤条件和游标方向
- **[新增]** 批量主键删除 `delete_by_primaryKeys`
- **[新增]** 事务批处理 `transaction`
- **[新增]** `IndexDbError` 专用错误类
- **[升级]** TypeScript 3.8 → 5.x
- **[升级]** 编译目标 ES2015 → ES2017，新增 `lib: DOM` 配置

### v0.0.8
- 初始版本发布
