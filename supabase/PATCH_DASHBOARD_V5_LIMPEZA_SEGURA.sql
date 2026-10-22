-- REAL OU IA? | Dashboard v5 / limpeza segura
-- Execute APÓS PATCH_ESTATISTICAS_V4.sql; não apaga dados ao instalar.
-- A senha de limpeza NÃO fica no JavaScript. Configure ao final no SQL Editor.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.config_limpeza_v5 (
  unica boolean PRIMARY KEY DEFAULT true CHECK (unica = true),
  senha_hash text NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  alterado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.config_limpeza_v5 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.config_limpeza_v5 FROM PUBLIC, anon, authenticated;

-- A configuração é feita EXCLUSIVAMENTE pelo proprietário do projeto no SQL Editor;
-- sem permissão de execução via navegador. Substituir senha requer SQL Editor.
CREATE OR REPLACE FUNCTION public.configurar_senha_limpeza_v5(p_senha text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,extensions,pg_temp AS $$
BEGIN
  IF length(coalesce(p_senha,'')) < 14 OR octet_length(p_senha)>72 THEN
    RAISE EXCEPTION 'Use senha de 14 a 72 bytes UTF-8';
  END IF;
  INSERT INTO public.config_limpeza_v5 (unica,senha_hash,tentativas,bloqueado_ate,alterado_em)
  VALUES (true,crypt(p_senha,gen_salt('bf')),0,NULL,now())
  ON CONFLICT (unica) DO UPDATE SET senha_hash=excluded.senha_hash,tentativas=0,
    bloqueado_ate=NULL,alterado_em=now();
END $$;
REVOKE ALL ON FUNCTION public.configurar_senha_limpeza_v5(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_status_limpeza_v5()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,extensions,pg_temp AS $$
DECLARE v_habilitada boolean; v_bloqueio timestamptz;
BEGIN
  IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT true,bloqueado_ate INTO v_habilitada,v_bloqueio
  FROM public.config_limpeza_v5 WHERE unica=true;
  RETURN jsonb_build_object('configurada',coalesce(v_habilitada,false),
    'bloqueada_ate',CASE WHEN v_bloqueio>now() THEN v_bloqueio ELSE NULL END,
    'participantes',(SELECT count(*) FROM public.participantes),
    'respostas',(SELECT count(*) FROM public.respostas),
    'comparacoes',(SELECT count(*) FROM public.respostas_comp));
END $$;
REVOKE ALL ON FUNCTION public.admin_status_limpeza_v5() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_status_limpeza_v5() TO authenticated;

-- Uma única transação: ou toda a exclusão acontece, ou nada é excluído.
-- As respostas individuais, comparações e sorteios são apagados por ON DELETE CASCADE.
-- Os CONTEÚDOS, GABARITOS, COMPARAÇÕES CADASTRADAS, ADMINS e arquivos de Storage ficam.
CREATE OR REPLACE FUNCTION public.admin_apagar_pesquisa_v5(p_senha text,p_confirmacao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,extensions,pg_temp AS $$
DECLARE v_hash text; v_tentativas integer; v_bloqueio timestamptz;
        v_participantes integer; v_respostas integer; v_comparacoes integer;
BEGIN
  IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_confirmacao IS DISTINCT FROM 'APAGAR DADOS DE TESTE' THEN
    RETURN jsonb_build_object('ok',false,'mensagem','Confirmação digitada incorretamente.');
  END IF;
  SELECT senha_hash,tentativas,bloqueado_ate
  INTO v_hash,v_tentativas,v_bloqueio
  FROM public.config_limpeza_v5 WHERE unica=true FOR UPDATE;
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('ok',false,'mensagem','Configure primeiro a senha no SQL Editor.');
  END IF;
  IF v_bloqueio IS NOT NULL AND v_bloqueio>now() THEN
    RETURN jsonb_build_object('ok',false,'mensagem','Tentativas excedidas. Aguarde 15 minutos.');
  END IF;
  IF crypt(coalesce(p_senha,''),v_hash) IS DISTINCT FROM v_hash THEN
    UPDATE public.config_limpeza_v5 SET
      tentativas=CASE WHEN v_tentativas+1>=5 THEN 0 ELSE v_tentativas+1 END,
      bloqueado_ate=CASE WHEN v_tentativas+1>=5 THEN now()+interval '15 minutes' ELSE NULL END
    WHERE unica=true;
    -- Não dar RAISE aqui: manter contagem de falhas mesmo com senha incorreta.
    RETURN jsonb_build_object('ok',false,'mensagem','Senha incorreta. Após cinco tentativas, haverá bloqueio temporário.');
  END IF;
  SELECT count(*) INTO v_respostas FROM public.respostas;
  SELECT count(*) INTO v_comparacoes FROM public.respostas_comp;
  DELETE FROM public.participantes;
  GET DIAGNOSTICS v_participantes=ROW_COUNT;
  -- As tabelas dependentes têm FKs ON DELETE CASCADE, portanto são apagadas automaticamente.
  UPDATE public.config_limpeza_v5 SET tentativas=0,bloqueado_ate=NULL WHERE unica=true;
  RETURN jsonb_build_object('ok',true,'participantes_apagados',v_participantes,
    'respostas_apagadas',v_respostas,'comparacoes_apagadas',v_comparacoes);
END $$;
REVOKE ALL ON FUNCTION public.admin_apagar_pesquisa_v5(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_apagar_pesquisa_v5(text,text) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';

-- PASSO OBRIGATÓRIO MANUAL, SOMENTE NO SQL EDITOR (NÃO COLE A SENHA NO CÓDIGO):
-- SELECT public.configurar_senha_limpeza_v5('COLOQUE-UMA-SENHA-FORTE-DE-14-A-72-BYTES');
-- NUNCA compartilhe a senha de limpeza com participantes.
