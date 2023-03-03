<!--
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-07 20:48:03
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-09 17:59:43
 -->
# ts-indexdb 
[![Build Status](https://travis-ci.com/swcbo/ts-indexdb.svg?branch=master)](https://app.travis-ci.com/github/swcbo/ts-indexdb)
## Install

```sh
npm install ts-indexdb
yarn add ts-indexdb
```
## Usage
### Typescript
```
import { init, getInstance } from 'ts-indexdb';
export type Rack =  {
    name: string
    id?: number
}
```

### javascript

```
import TsIndexDb = require('ts-indexdb');
```
## 数据库操作方法
### 注意
* 当前类为单例模式只要init一次,后面直接getInstance获取实例来操作数据库
* 操作返回的均为Promis对象
* js不用加泛型
### 数据库与表操作
方法|方法名|参数|属性
--|:--|:--:|:--
open_db|打开数据库|无|-
close_db|关闭数据库|无|-
delete_db|删除数据库|String|name
delete_table|删除表数据|String|tableName


### 查询操作(query)
方法|方法名|参数|属性
--|:--|:--:|:--
queryAll|查询某张表的所有数据(返回具体数组)|Object|{ tableName }
query|查询(返回具体数组)|Object|{ tableName, condition }
query_by_keyValue|查询数据(更具表具体属性)返回具体某一个|Object|{ tableName, key, value }
query_by_primaryKey|查询数据（主键值）|Object|{ tableName, value }
count|查询数据（主键值）|Object|{ tableName, key, countCondition:{type,rangeValue } }

### 更新操作(update)
方法|方法名|参数|属性
--|:--|:--:|:--
update|更具条件修改数据(返回修改的数组)|Object|{ tableName, condition, handle }
update_by_primaryKey|修改某条数据(主键)返回修改的对象|Object|{  tableName, value, handle }

### 插入操作(insert)
方法|方法名|参数|属性
--|:--|:--:|:--
insert|增加数据|Object|{ tableName, data(数组或者单独对象) }

### 删除操作(delete)
方法|方法名|参数|属性
--|:--|:--:|:--
delete|根据条件删除数据(返回删除数组)|Object|{ tableName, condition }
delete_by_primaryKey|删除数据(主键)|Object|{ tableName, value }


## 例子：
### 初始化
```
await init({
    dbName: "books",        // 数据库名称               
    version: 1,             // 版本号                
    tables: [                               
        {
            tableName: "bookrackList",         // 表名         
            option: { keyPath: "id", autoIncrement: true }, // 指明主键为id
            indexs: [    // 数据库索引
                {
                    key: "id",
                    option: {
                        unique: true
                    }
                },
                {
                    key: "name"
                }
            ]
        }
    ]
})
```
### 查询
 ```
  /**
    * @method 查询某张表的所有数据(返回具体数组)
    * @param {Object}
    *   @property {String} tableName 表名
    */
  await getInstance().queryAll<Rack>({
    tableName: 'bookrackList'
  });


  /**
    * @method 查询(返回具体数组)
    * @param {Object}
    *   @property {String} tableName 表名
    *   @property {Function} condition 查询的条件
    * */
  await getInstance().query<Rack>({
     tableName: 'bookrackList',
     condition: item => item.id === 3
   });

  /**
    * @method 查询数据(更具表具体属性)返回具体某一个
    * @param {Object}
    *   @property {String} tableName 表名
    *   @property {Number|String} key 名
    *   @property {Number|String} value 值
    *
    * */
  await getInstance().query_by_keyValue<Rack>({
     tableName: 'bookrackList',
     key: 'name',
     value: '我师兄实在太稳健了'
   });

  /**
    * @method 查询数据（主键值）
    * @param {Object}
    *   @property {String} tableName 表名
    *   @property {Number|String} value 主键值
    *
    * */ 
  await getInstance().query_by_primaryKey<Rack>({
     tableName: 'bookrackList',
     value: 3
   });
  /**
     * @method 查询满足key条件的个数(返回满足条件的数字个数)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Number|String} key 查询的key
     *   @property {Object} countCondition 查询条件
   * */
  /** countCondition传入方式 key 必须为已经简历索引的字段
   *  key ≥ x	            {key: 'gt' rangeValue: [x]}
      key > x	            {key: 'gt' rangeValue: [x, true]}
      key ≤ y	            {key: 'lt' rangeValue: [y]}
      key < y	            {key: 'lt' rangeValue: [y, true]}
      key ≥ x && ≤ y	    {key: 'between' rangeValue: [x, y]}
      key > x &&< y	    {key: 'between' rangeValue: [x, y, true, true]}
      key > x && ≤ y	    {key: 'between' rangeValue: [x, y, true, false]}
      key ≥ x &&< y	    {key: 'between' rangeValue: [x, y, false, true]}
      key = z	            {key: 'equal' rangeValue: [z]}
   */
  await getInstance().count<Rack>({
    tableName: 'bookrackList',
    key: 'createdTime',
    countCondition: {
      type: 'between',
      rangeValue:[1676627113088,new Date().getTime()]
    }
  })

  ```

### 更新
```
  /**
     * @method 修改数据(返回修改的数组)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Function} condition 查询的条件，遍历，与filter类似
     *      @arg {Object} 每个元素
     *      @return 条件
     *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
     * */
  await getInstance().update<Rack>({
        tableName: 'bookrackList',
        condition: item => item.id === 8,
        handle: r => {
          r.name = '测试修改';
          return r;
        }
  })


  /**
  * @method 修改某条数据(主键)返回修改的对象
  * @param {Object}
  *   @property {String} tableName 表名
  *   @property {String\|Number} value 目标主键值
  *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
  * */
  await getInstance().update_by_primaryKey<Rack>({
        tableName: 'bookrackList',
        value: 1,
        handle: r => {
          r.name = '测试修改';
          return r;
        }
  })

```
### 增加
```
  /**
     * @method 增加数据
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Object} data 插入的数据
     * */
  await getInstance().insert<Rack>({
    tableName: 'bookrackList',
    data: {
      name: '测试',
    }
  })
```

### 删除

    
    /**
      * @method 删除数据(返回删除数组)
      * @param {Object}
      *   @property {String} tableName 表名
      *   @property {Function} condition 查询的条件，遍历，与filter类似
      *      @arg {Object} 每个元素
      *      @return 条件
      * */
    await getInstance().delete<Rack>({
      tableName: 'bookrackList',
      condition: (item)=> item.name === '测试',
    })


     /**
      * @method 删除数据(主键)
      * @param {Object}
      *   @property {String} tableName 表名
      *   @property {String\|Number} value 目标主键值
      * */
    await getInstance().delete_by_primaryKey<Rack>({
      tableName: 'bookrackList',
      value: 4
    })

    /**
      * @method 删除表数据
      * @param {String}name 数据库名称
      */
    await getInstance().delete_table('bookrackList')


    /**
      * @method 删除数据库
      * @param {String}name 数据库名称
      */
    await getInstance().delete_db('bookrackList')
