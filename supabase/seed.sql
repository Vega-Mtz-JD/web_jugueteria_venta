-- Datos de prueba: categorías, ajustes de la tienda y 18 productos simulados.
-- Todos los productos tienen is_sample = true y se borran con delete_sample_products().
-- Casos especiales a propósito: 1 agotado (Exploding Kittens), 1 con stock 2 (Jenga),
-- 1 oferta (Scrabble), 2 nuevos, 1 sin fotos (Cubo 4x4), 1 nombre largo (ruleta), 1 inactivo (Risk).

insert into public.store_settings (store_name, tagline, whatsapp_phone, address, pickup_hours)
values ('Ludiq', 'Juegos de mesa para pensar y compartir', '+59170000000', 'La Paz, Bolivia', 'Lun a Sáb, 10:00–19:00');

insert into public.categories (name, slug, sort_order) values
  ('Estrategia', 'estrategia', 1),
  ('Clásicos en familia', 'clasicos-familia', 2),
  ('Cartas', 'cartas', 3),
  ('Casino', 'casino', 4),
  ('Destreza y canchitas', 'destreza-canchitas', 5),
  ('Cubos y rompecabezas', 'cubos-rompecabezas', 6);

with data (name, slug, category, description, price_bs, compare_bs, min_age, min_players, max_players, stock, is_new, is_active) as (
  values
    ('Catán', 'catan', 'estrategia', 'Coloniza la isla, comercia recursos y construye caminos y ciudades. El clásico moderno de estrategia.', 450, null, 10, 3, 4, 5, false, true),
    ('Ajedrez de madera plegable', 'ajedrez-madera-plegable', 'estrategia', 'Tablero de madera que se cierra como maletín, con piezas talladas guardadas dentro.', 120, null, 6, 2, 2, 8, false, true),
    ('Carcassonne', 'carcassonne', 'estrategia', 'Arma el paisaje medieval loseta a loseta y coloca a tus seguidores en ciudades, caminos y monasterios.', 320, null, 8, 2, 5, 4, true, true),
    ('Risk', 'risk', 'estrategia', 'Conquista el mundo territorio por territorio.', 300, null, 10, 2, 6, 3, false, false),
    ('Monopolio Clásico', 'monopolio-clasico', 'clasicos-familia', 'Compra propiedades, construye casas y hoteles, y no caigas en la cárcel.', 280, null, 8, 2, 6, 6, false, true),
    ('Scrabble Original', 'scrabble-original', 'clasicos-familia', 'Forma palabras cruzadas y suma puntos con las casillas especiales. Edición en español.', 220, 260, 10, 2, 4, 5, false, true),
    ('Jenga', 'jenga', 'clasicos-familia', 'Saca un bloque, ponlo arriba y que no se caiga la torre. Pulso firme y nervios de acero.', 150, null, 6, 1, null, 2, false, true),
    ('UNO', 'uno', 'cartas', 'El juego de cartas más rápido: combina colores y números y no olvides gritar ¡UNO!', 35, null, 7, 2, 10, 20, false, true),
    ('Dobble', 'dobble', 'cartas', 'Encuentra el único símbolo en común entre dos cartas antes que nadie.', 90, null, 6, 2, 8, 7, false, true),
    ('Exploding Kittens', 'exploding-kittens', 'cartas', 'Ruleta rusa con gatitos: evita robar el gatito explosivo.', 160, null, 7, 2, 5, 0, false, true),
    ('Set de póker 200 fichas con maletín', 'set-poker-200-fichas', 'casino', 'Maletín de aluminio con 200 fichas, dos barajas, dados y botón de dealer.', 260, null, 14, 2, 10, 4, false, true),
    ('Ruleta de casino de mesa con paño de juego y fichas de colores para toda la familia', 'ruleta-casino-mesa', 'casino', 'Ruleta giratoria de 30 cm con paño plegable y fichas de cinco colores.', 180, null, 12, 1, null, 3, false, true),
    ('Mini canchita de fútbol de mesa', 'mini-canchita-futbol', 'destreza-canchitas', 'Canchita portátil con jugadores de resorte. Ideal para jugar en cualquier mesa.', 180, null, 6, 2, 2, 6, true, true),
    ('Futbolín de madera mediano', 'futbolin-madera-mediano', 'destreza-canchitas', 'Futbolín de 90 cm con barras de acero, marcador y dos pelotas.', 650, null, 8, 2, 4, 2, false, true),
    ('Hockey de mesa', 'hockey-de-mesa', 'destreza-canchitas', 'Desliza el disco con tu paleta y anota en el arco rival.', 240, null, 6, 2, 2, 5, false, true),
    ('Cubo Rubik 3x3 Speed', 'cubo-rubik-3x3-speed', 'cubos-rompecabezas', 'Cubo magnético de giro suave, pensado para armar rápido. Sin stickers.', 60, null, 8, 1, 1, 15, false, true),
    ('Cubo 4x4 magnético', 'cubo-4x4-magnetico', 'cubos-rompecabezas', 'El siguiente reto después del 3x3: más piezas, más algoritmos.', 110, null, 10, 1, 1, 6, false, true),
    ('Laberinto 3D esfera', 'laberinto-3d-esfera', 'cubos-rompecabezas', 'Guía la bolita por 100 obstáculos girando la esfera transparente.', 90, null, 8, 1, 1, 9, false, true)
)
insert into public.products (name, slug, category_id, description, price_cents, compare_at_cents, min_age, min_players, max_players, stock, is_new, is_active, is_sample)
select d.name, d.slug, c.id, d.description, d.price_bs * 100, d.compare_bs * 100, d.min_age, d.min_players, d.max_players, d.stock, d.is_new, d.is_active, true
from data d join public.categories c on c.slug = d.category;

-- Una ilustración por producto, salvo el Cubo 4x4 (prueba el caso "sin fotos").
insert into public.product_images (product_id, path, alt, sort_order)
select p.id, '/samples/' || p.slug || '.svg', p.name, 0
from public.products p
where p.slug <> 'cubo-4x4-magnetico';
