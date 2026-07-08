-- 种子数据 for 生产环境: 垂直达人建联模块
-- 前置: 已执行 db.ts 建表 + ALTER TABLE 迁移
-- 执行方式: psql -U <user> -d <db> -f seed_vc_data.sql

-- 达人资料
INSERT INTO public.influencer_profiles_full (id, influencer_code, contact_method, followers, category, grade, avg_views, engagement_rate, posts_count, is_verified, avg_likes, cooperation_count, experience_years, bio, avatar_url, cover_url, user_id, status, created_at, updated_at, quoted_price, cooperation_conditions)
VALUES (1, 'SELF001', 'contact_us', '500K', '美妆类', 'B', '50000', '30', '200', true, '30000', '5', NULL, '自主达人-已关联influencer002', NULL, NULL, 4, 'active', '2026-07-08 15:29:32', '2026-07-08 15:29:32', 1500.00, '需要产品寄样，要求品牌知名度')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.influencer_profiles_full (id, influencer_code, contact_method, followers, category, grade, avg_views, engagement_rate, posts_count, is_verified, avg_likes, cooperation_count, experience_years, bio, avatar_url, cover_url, user_id, status, created_at, updated_at, quoted_price, cooperation_conditions)
VALUES (2, 'MANAGED001', 'contact_them', '1.2M', '美妆类', 'A+', '120000', '60', '500', true, '80000', '12', '20', '托管达人-未关联用户，由管理员代理操作', NULL, NULL, 5, 'active', '2026-07-08 15:29:39', '2026-07-08 15:30:17', 3000.00, '只接大品牌合作，需签合同，不接受修改')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.influencer_profiles_full (id, influencer_code, contact_method, followers, category, grade, avg_views, engagement_rate, posts_count, is_verified, avg_likes, cooperation_count, experience_years, bio, avatar_url, cover_url, user_id, status, created_at, updated_at, quoted_price, cooperation_conditions)
VALUES (3, 'TEST-MANAGED', 'contact_them', '100K', '美妆类', 'C', '8000', '20', '50', false, NULL, NULL, NULL, 'proxy-respond测试', NULL, NULL, 6, 'active', '2026-07-08 15:44:24', '2026-07-08 15:44:24', 800.00, '测试用')
ON CONFLICT (id) DO NOTHING;

-- 建联记录
INSERT INTO public.influencer_connections (id, client_id, influencer_id, influencer_profile_id, category, grade, brief, budget, start_date, end_date, status, renewal_count, created_at, updated_at, intervention_note)
VALUES (1, 3, 4, 1, '美妆类', 'B', '希望合作美妆产品推广', '5000', '2026-07-08 15:30:17', '2026-08-07 15:33:28', 'active', 1, '2026-07-08 15:30:17', '2026-07-08 15:33:28', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.influencer_connections (id, client_id, influencer_id, influencer_profile_id, category, grade, brief, budget, start_date, end_date, status, renewal_count, created_at, updated_at, intervention_note)
VALUES (2, 3, 5, 2, '美妆类', 'A+', '大品牌美妆合作项目', '10000', '2026-07-08 15:30:17', '2026-08-07 15:30:17', 'active', 0, '2026-07-08 15:30:17', '2026-07-08 15:31:12', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.influencer_connections (id, client_id, influencer_id, influencer_profile_id, category, grade, brief, budget, start_date, end_date, status, renewal_count, created_at, updated_at, intervention_note)
VALUES (3, 3, 6, 3, '美妆类', 'C', '测试', '2000', '2026-07-08 15:44:24', '2026-08-07 15:44:24', 'active', 0, '2026-07-08 15:44:24', '2026-07-08 15:44:24', NULL)
ON CONFLICT (id) DO NOTHING;

-- 派单记录
INSERT INTO public.connection_orders (id, connection_id, client_id, influencer_id, influencer_profile_id, order_no, title, task_requirements, delivery_standards, deadline, submission_types, amount, influencer_response, submission_content, status, review_status, review_note, review_count, payment_voucher, payment_status, payment_verified, created_at, updated_at)
VALUES (1, 1, 3, 4, 1, 'CO-1783499485182-2XHTEB', '夏季美妆新品推广视频', '拍摄30秒美妆教程视频，展示产品使用效果，需露出产品包装', '1080P高清，无水印，需添加品牌话题标签', '2026-07-15 18:00:00', 'video', 1500.00, 'accepted', '【已修改】视频链接: https://tiktok.com/@influencer/video/12345-v2 | 百度网盘: https://pan.baidu.com/s/xxxx-v2 | 已调整亮度+添加品牌logo水印', 'completed', 'approved', '画面亮度不够，请重新调色后提交，另外请加上品牌logo水印', 1, 'https://example.com/vouchers/payment-proof-20260708.png', 'paid', false, '2026-07-08 15:31:25', '2026-07-08 15:32:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.connection_orders (id, connection_id, client_id, influencer_id, influencer_profile_id, order_no, title, task_requirements, delivery_standards, deadline, submission_types, amount, influencer_response, submission_content, status, review_status, review_count, payment_voucher, payment_status, payment_verified, created_at, updated_at)
VALUES (2, 2, 3, 5, 2, 'CO-1783499485210-C6JBQC', '高端美妆品牌代言视频', '拍摄60秒产品代言视频，展示品牌理念和产品质感', '4K高清，专业灯光，需品牌方审核后发布', '2026-07-20 18:00:00', 'video,photo', 3000.00, 'accepted', '【托管达人作品】视频链接: https://drive.google.com/file/managed-001 | 品牌代言视频60s，4K画质，已按品牌要求拍摄', 'completed', 'approved', 0, 'https://example.com/vouchers/managed-payment-proof.png', 'paid', true, '2026-07-08 15:31:25', '2026-07-08 15:33:18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.connection_orders (id, connection_id, client_id, influencer_id, influencer_profile_id, order_no, title, task_requirements, delivery_standards, deadline, submission_types, amount, influencer_response, status, review_status, review_count, payment_status, payment_verified, created_at, updated_at)
VALUES (3, 3, 3, 6, 3, 'CO-1783500264734-1O1QLU', '测试代理派单', '测试要求', '测试标准', '2026-07-20 18:00:00', 'video', 800.00, 'accepted', 'submitted', 'pending_review', 0, 'unpaid', false, '2026-07-08 15:44:24', '2026-07-08 15:44:24')
ON CONFLICT (id) DO NOTHING;

-- 重置序列
SELECT setval('public.influencer_profiles_full_id_seq', 3, true);
SELECT setval('public.influencer_connections_id_seq', 3, true);
SELECT setval('public.connection_orders_id_seq', 3, true);
