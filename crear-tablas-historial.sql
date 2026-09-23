-- Ejecutar en Supabase → SQL Editor → Run
-- Crea una tabla por cada tipo de historial, en vez de guardarlo todo junto en bodega_sync

create table if not exists bodega_ventas (
  tienda text not null,
  id bigint not null,
  datos jsonb not null,
  primary key (tienda, id)
);
create table if not exists bodega_cajas (
  tienda text not null,
  id bigint not null,
  datos jsonb not null,
  primary key (tienda, id)
);
create table if not exists bodega_movimientos (
  tienda text not null,
  id bigint not null,
  datos jsonb not null,
  primary key (tienda, id)
);
create table if not exists bodega_devoluciones (
  tienda text not null,
  id bigint not null,
  datos jsonb not null,
  primary key (tienda, id)
);
create table if not exists bodega_pagos_proveedores (
  tienda text not null,
  id bigint not null,
  datos jsonb not null,
  primary key (tienda, id)
);

-- Seguridad: mismo criterio permisivo que ya usa bodega_sync (acceso con la anon key)
alter table bodega_ventas enable row level security;
alter table bodega_cajas enable row level security;
alter table bodega_movimientos enable row level security;
alter table bodega_devoluciones enable row level security;
alter table bodega_pagos_proveedores enable row level security;

create policy "permitir todo" on bodega_ventas for all using (true) with check (true);
create policy "permitir todo" on bodega_cajas for all using (true) with check (true);
create policy "permitir todo" on bodega_movimientos for all using (true) with check (true);
create policy "permitir todo" on bodega_devoluciones for all using (true) with check (true);
create policy "permitir todo" on bodega_pagos_proveedores for all using (true) with check (true);
