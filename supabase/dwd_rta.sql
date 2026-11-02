-- DarkWebDark: RTAモードのオンラインランキング
-- 共有Supabaseプロジェクト(kifnzvktwbomxthzvvgy)に、このゲーム専用の
-- テーブルとして追加する。他のテーブルには一切触れない。
--
-- 実行方法: Supabaseダッシュボード → SQL Editor に全部貼り付けて実行(一度だけでOK)。

create table if not exists public.dwd_rta_scores (
  player_id text primary key
    check (char_length(player_id) between 16 and 64),      -- ブラウザごとの匿名ID
  name text not null
    check (char_length(btrim(name)) between 1 and 12),      -- 表示名(1〜12文字)
  ms integer not null
    check (ms between 30000 and 10800000),                  -- 30秒〜3時間のみ受け付ける
  ver text,
  updated_at timestamptz not null default now()
);

create index if not exists dwd_rta_scores_ms_idx on public.dwd_rta_scores (ms);

alter table public.dwd_rta_scores enable row level security;

-- だれでも閲覧できる(ロールは絞らない：kaikomziu.github.io の他ゲームの
-- ログインセッションが混線しても読めるように)
drop policy if exists "dwd_rta_scores_select" on public.dwd_rta_scores;
create policy "dwd_rta_scores_select"
  on public.dwd_rta_scores
  for select
  using (true);

-- 直接の INSERT/UPDATE/DELETE は許可しない(ポリシー無し = 不可)。
-- 登録は下の関数経由のみ：自己ベストより速いときだけ上書きする。
create or replace function public.dwd_submit_rta(
  p_player text,
  p_name text,
  p_ms integer,
  p_ver text default null
)
returns integer   -- 登録後のその人のベストタイム(ms)
language plpgsql
security definer
set search_path = public
as $$
declare
  best integer;
begin
  if p_player is null or char_length(p_player) not between 16 and 64 then
    raise exception 'invalid player';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 12 then
    raise exception 'invalid name';
  end if;
  if p_ms is null or p_ms not between 30000 and 10800000 then
    raise exception 'invalid time';
  end if;

  insert into public.dwd_rta_scores as s (player_id, name, ms, ver, updated_at)
  values (p_player, btrim(p_name), p_ms, left(p_ver, 16), now())
  on conflict (player_id) do update
    set name = excluded.name,
        ms = least(s.ms, excluded.ms),
        ver = case when excluded.ms < s.ms then excluded.ver else s.ver end,
        updated_at = case when excluded.ms < s.ms then now() else s.updated_at end
  returning ms into best;

  return best;
end;
$$;

revoke all on function public.dwd_submit_rta(text, text, integer, text) from public;
grant execute on function public.dwd_submit_rta(text, text, integer, text) to anon, authenticated;
