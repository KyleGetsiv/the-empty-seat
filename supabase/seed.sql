-- seed.sql
-- Initial company rows. All competitor rows are for future comparative data
-- use only; none are surfaced on the Waymo-only public frontend.

insert into companies (slug, display_name, founded_year, parent_company) values
  ('waymo',        'Waymo',         2009, 'Alphabet'),
  ('tesla',        'Tesla',         2003, null),
  ('zoox',         'Zoox',          2014, 'Amazon'),
  ('pony-ai',      'Pony.ai',       2016, null),
  ('weride',       'WeRide',        2017, null),
  ('baidu-apollo', 'Baidu Apollo',  2017, 'Baidu');
