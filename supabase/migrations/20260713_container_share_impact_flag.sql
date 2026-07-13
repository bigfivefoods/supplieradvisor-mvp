-- Optional flag: show people-fed / jobs impact on public container embed

SELECT public.sa_add_column(
  'container_network_shares',
  'show_impact',
  'boolean',
  'true'
);
