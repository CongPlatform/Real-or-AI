-- DIAGNÓSTICO SOMENTE LEITURA: não altera ou exclui qualquer registro.
-- Rode no SQL Editor do MESMO projeto Supabase configurado no site.
WITH tipos(tipo) AS (
  VALUES ('imagem'), ('audio'), ('texto'), ('video')
), estatisticas AS (
  SELECT cp.id, cp.tipo, cp.ativo,
         COUNT(c.id) AS itens,
         COUNT(g.conteudo_id) AS itens_com_gabarito,
         COUNT(*) FILTER (WHERE g.eh_ia = true) AS itens_ia,
         COUNT(*) FILTER (WHERE g.eh_ia = false) AS itens_humanos
  FROM public.comparacoes cp
  LEFT JOIN public.conteudos c ON c.comparacao_id = cp.id
  LEFT JOIN public.gabarito g ON g.conteudo_id = c.id
  GROUP BY cp.id, cp.tipo, cp.ativo
), resumos AS (
  SELECT t.tipo,
    (SELECT COUNT(*) FROM public.conteudos c WHERE c.tipo = t.tipo AND c.comparacao_id IS NULL) AS individuais,
    (SELECT COUNT(*) FROM public.conteudos c WHERE c.tipo = t.tipo AND c.comparacao_id IS NOT NULL) AS itens_em_comparacoes,
    (SELECT COUNT(*) FROM estatisticas e WHERE e.tipo = t.tipo) AS comparacoes_cadastradas,
    (SELECT COUNT(*) FROM estatisticas e WHERE e.tipo = t.tipo AND e.ativo) AS comparacoes_ativas,
    (SELECT COUNT(*) FROM estatisticas e WHERE e.tipo = t.tipo AND e.itens = 2 AND e.itens_com_gabarito = 2) AS comparacoes_completas,
    (SELECT COUNT(*) FROM estatisticas e WHERE e.tipo = t.tipo AND (e.itens <> 2 OR e.itens_com_gabarito <> 2)) AS incompletas,
    (SELECT COUNT(*) FROM estatisticas e WHERE e.tipo = t.tipo AND e.itens = 2 AND e.itens_ia = 1 AND e.itens_humanos = 1) AS ia_vs_humano
  FROM tipos t
)
SELECT * FROM resumos ORDER BY CASE tipo
  WHEN 'imagem' THEN 1 WHEN 'audio' THEN 2 WHEN 'texto' THEN 3 ELSE 4 END;
