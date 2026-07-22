"""数据库迁移脚本 — 为现有 users 表添加会员字段"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'memo_deer.db')
db_path = os.path.abspath(db_path)

if not os.path.exists(db_path):
    print('数据库文件不存在，首次启动后端时会自动创建，无需迁移')
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 查看现有列
cursor.execute('PRAGMA table_info(users)')
cols = [row[1] for row in cursor.fetchall()]
print(f'现有 users 列: {cols}')

# 逐个添加缺失的列
migrations = [
    ('is_premium', 'INTEGER DEFAULT 0'),
    ('premium_type', "TEXT DEFAULT 'free'"),
    ('premium_expire_at', 'TEXT'),
]

for col_name, col_def in migrations:
    if col_name not in cols:
        try:
            cursor.execute(f'ALTER TABLE users ADD COLUMN {col_name} {col_def}')
            print(f'  + 已添加列: {col_name}')
        except Exception as e:
            print(f'  ! 添加列 {col_name} 失败: {e}')
    else:
        print(f'  = 列已存在: {col_name}')

conn.commit()

# 重置 NULL 值为默认
cursor.execute("UPDATE users SET is_premium = 0 WHERE is_premium IS NULL")
cursor.execute("UPDATE users SET premium_type = 'free' WHERE premium_type IS NULL")
conn.commit()

# 验证
cursor.execute('PRAGMA table_info(users)')
new_cols = [row[1] for row in cursor.fetchall()]
print(f'迁移后 users 列: {new_cols}')
print('数据库迁移完成！原有账号不受影响。')

conn.close()
