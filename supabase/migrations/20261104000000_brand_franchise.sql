-- Franchise status for Brand Matcher.
--
-- A brand whose UK sites are run by franchisee companies has no single Companies House record
-- that represents it, so Brand Matcher shows "Franchise" in place of the financials when we
-- are highly confident of it. One row per brand we have researched; confidence records how sure
-- we are, and only 'high' changes what Brand Matcher shows or scores. 'medium' and 'low' are
-- kept so an admin can review and promote them.
--
-- Service-role only (RLS on, no policies), like brand_companies: reads go through the Brand
-- Matcher engine and the admin routes.

CREATE TABLE IF NOT EXISTS public.brand_franchise (
  brand_id    uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  confidence  text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  -- Where the judgement comes from, e.g. the brand's franchising page.
  source_url  text,
  notes       text,
  checked_at  date NOT NULL DEFAULT current_date,
  updated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brand_franchise IS
  'Brands whose UK sites are run by franchisees. Only confidence = high is shown in Brand Matcher, in place of Companies House financials.';

ALTER TABLE public.brand_franchise ENABLE ROW LEVEL SECURITY;

-- Seed: the Companies House research of 16 Oct 2026 (34 brands judged franchised). Brands no
-- longer in the directory are skipped.
INSERT INTO public.brand_franchise (brand_id, confidence, source_url, notes, checked_at)
SELECT v.brand_id, v.confidence, v.source_url,
       'UK locations are operated through franchise, partner or licence structures; one company number would not represent the brand network.',
       DATE '2026-10-16'
FROM (VALUES
  ('710a9a12-0414-4abe-835e-8b6139837d11'::uuid, 'medium', 'https://www.battlekart.com', 'Battle Kart'),
  ('9135598d-f729-4f5e-aac7-1a243683d2eb'::uuid, 'high', 'https://www.bodyfittraining.au/', 'BFT'),
  ('3c67f5bb-9c14-405b-986d-81780e5bdbd6'::uuid, 'medium', 'https://boombattlebar.com/uk', 'Boom Battle Bar'),
  ('2274a828-b18c-562c-a09d-337deaa44b5f'::uuid, 'medium', 'https://www.budgens.co.uk', 'Budgens'),
  ('f89bdc89-af64-4487-a144-d93bf0c59409'::uuid, 'medium', 'https://burgerandsauce.com/', 'Burger & Sauce'),
  ('786fbdab-5fb9-4078-a8d5-1bd253b6db83'::uuid, 'high', 'https://www.burgerking.co.uk', 'Burger King'),
  ('f1ca43ab-ca0d-5b43-8e72-8cc19e6357a8'::uuid, 'medium', 'https://centra.ie', 'Centra'),
  ('37f2f023-4bf3-4679-b2c5-d93dc7784db1'::uuid, 'medium', 'https://www.chaiiwala.co.uk', 'Chaiiwala'),
  ('ded979ac-7f88-49e7-9c26-e258838543d2'::uuid, 'high', 'https://www.clubpilates.uk', 'Club Pilates UK'),
  ('bd92be52-9512-4a32-be4c-760a48ff3a45'::uuid, 'medium', 'https://www.coyoteuglysaloonuk.com/', 'Coyote Ugly Saloon'),
  ('899196be-6602-42b9-bcc2-b445077b7dc4'::uuid, 'high', 'https://f45training.com', 'F45 Training'),
  ('3cdfb463-b3bf-4c46-a58a-b27672a91095'::uuid, 'medium', 'https://fatphillsdiner.co.uk/', 'Fat Phill''s'),
  ('b444a9f6-62c6-4ce7-9883-3e5a4eed1464'::uuid, 'medium', 'https://www.flipout.co.uk', 'Flip Out'),
  ('35c055d1-26e8-41cc-9341-5354b95cef19'::uuid, 'medium', NULL, 'FlipOut'),
  ('b13f2681-6797-4965-b98a-a43e6e759c7f'::uuid, 'medium', 'https://www.hautedolci.com', 'Haute Dolci'),
  ('fe6503d0-4e96-4d4e-b9af-64f4a950507c'::uuid, 'medium', 'https://katieobriensirishtaverns.com/', 'Katie O''Briens Irish Tavern'),
  ('4526b7c8-1c10-45a3-abc6-d97f6c6de032'::uuid, 'high', 'https://www.kfc.co.uk', 'KFC'),
  ('72e4ad8c-7c17-4461-a586-94454092935c'::uuid, 'high', 'https://www.mathnasium.com/uk/', 'Mathnasium'),
  ('96ffc611-b8d8-4d27-b9ca-d1d438be6d9c'::uuid, 'medium', 'https://mrsimms.co', 'Mr.Simms'),
  ('331da8c1-7646-4f73-ad50-434b7a29752c'::uuid, 'medium', 'https://muffinbreak.co.uk/', 'Muffin Break'),
  ('67ba942b-0e73-4f98-8101-d5b2cbae8efa'::uuid, 'high', NULL, 'Papa John''s'),
  ('c7032262-60bf-4908-9dcd-8c79ecdf2658'::uuid, 'medium', 'https://www.plusfitness.co.uk', 'Plus Fitness'),
  ('b919fc14-54f1-4455-88e5-a294bc3e4487'::uuid, 'medium', 'https://popeyesuk.com', 'Popeyes'),
  ('ba3cbc43-d01e-4d43-92d7-bae3ee847291'::uuid, 'medium', 'https://rassams.co.uk', 'Rassams Creamery'),
  ('3d3eb77c-4a24-4945-89f3-1671827f49eb'::uuid, 'medium', 'https://www.slimchickens.co.uk', 'Slim Chickens'),
  ('da959758-480c-434d-836b-f64ee0264a0f'::uuid, 'medium', 'https://smokyboys.com/', 'Smoky Boys'),
  ('85a5c5ee-0da5-4a71-a2d9-6036ca3300cb'::uuid, 'high', 'https://www.snapfitness.com/uk', 'Snap Fitness'),
  ('51b6c14e-5557-4b60-87b1-25fd4d56f2c6'::uuid, 'medium', 'https://sostrenegrene.com/en-gb', 'Sostrene Grene'),
  ('fb70574b-2aff-4132-94aa-ddd7734750f6'::uuid, 'high', NULL, 'Specsavers'),
  ('743edf75-58be-49c2-b39c-0faec73fa1dc'::uuid, 'high', 'https://www.subway.com/en-GB', 'Subway'),
  ('d1a3b299-44c3-4d98-9f1b-f508a36a246e'::uuid, 'medium', 'https://www.tacobell.co.uk', 'Taco Bell'),
  ('a2936fb5-2f43-440f-9c23-6749ac1990a4'::uuid, 'high', NULL, 'Vets4Pets'),
  ('31b0c325-d3b0-434e-94a0-d703fa39aa05'::uuid, 'medium', 'https://www.wingstop.co.uk', 'Wingstop'),
  ('77de3528-ecca-4c92-8bf4-a97cd9ff9a45'::uuid, 'medium', 'https://www.yole.com', 'Yolé')
) AS v(brand_id, confidence, source_url, brand_name)
JOIN public.brands b ON b.id = v.brand_id
ON CONFLICT (brand_id) DO NOTHING;
