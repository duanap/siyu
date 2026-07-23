# 信息架构

## 底部导航

1. 首页
2. 明细
3. 记账
4. 统计
5. 我的

“记账”使用中间突出入口。

## 一级功能结构

```mermaid
flowchart TB
    APP[四时有余]
    APP --> HOME[首页]
    APP --> ENTRIES[明细]
    APP --> CREATE[记一笔]
    APP --> STAT[统计]
    APP --> ME[我的]

    HOME --> LEDGER[账本切换]
    HOME --> SALARY[工资]
    HOME --> DEBT[借贷]
    HOME --> RECUR[周期记账]
    HOME --> SAVING[攒钱目标]

    LEDGER --> PERSONAL[个人账本]
    LEDGER --> COUPLE[情侣账本]

    ME --> PROFILE[个人资料]
    ME --> THEME[主题]
    ME --> NOTICE[通知]
    ME --> EXPORT[导出]
    ME --> COUPLE_MGMT[情侣账本管理]
    ME --> CATEGORY_MGMT[分类管理]
```

## 页面路由

- `/login`
- `/home`
- `/entries`
- `/entries/new`
- `/entries/:id`
- `/categories`
- `/statistics`
- `/debts`
- `/debts/new`
- `/debts/:id`
- `/recurring`
- `/recurring/new`
- `/recurring/:id`
- `/salary`
- `/salary/:year/:month`
- `/salary/year/:year`
- `/saving-goals`
- `/saving-goals/new`
- `/saving-goals/:id`
- `/couple/invite`
- `/couple/join`
- `/notifications`
- `/exports`
- `/profile`
- `/settings`
