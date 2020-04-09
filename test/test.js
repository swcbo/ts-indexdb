'use strict';
const expect = require('chai').expect;
var jsdom = require('jsdom')
const IndexDb = require('../dist/lib/index').default;

describe('test indexdb', () => {
    // jsdom()
    it('has document', () => {
        const result = IndexDb({
            dbName: "books",                          // *数据库名称
            version: 1,                                 // 数据库版本号（默认为当前时间戳）
            tables: [                                   // *数据库的表，即ObjectStore
                {
                    tableName: "bookrackList",                      // *表名 另外一张表，同理
                    option: { keyPath: "id", autoIncrement: true },
                    indexs: [
                        {
                            key: "id",
                            option: {
                                unique: true
                            }
                        },
                        {
                            key: "name"
                        },
                        // 书籍地址
                        {
                            key: "bookUrl"
                        },
                        // 书源地址
                        {
                            key: "bookSourceUrl"
                        },
                        // 书本详情地址
                        {
                            key: "tocUrl"
                        },
                        // 章节地址
                        {
                            key: "readIndex"
                        },
                        {
                            key: "checked"
                        },
                        {
                            key: "coverUrl"
                        },
                        {
                            key: "origin"
                        }, {
                            key: "author"
                        },
                        {
                            key: "originName"
                        }
                    ]
                }
            ]
        });
        expect(result)
    });
});