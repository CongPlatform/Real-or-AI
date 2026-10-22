# Real ou IA?

1. Supabase > SQL Editor: cole TODO o `supabase/schema.sql` e rode (antes, troque o e-mail na última linha).
2. Supabase > Authentication > Users: crie o usuário admin (e-mail + senha) com o MESMO e-mail do passo 1.
   Se criar o usuário depois de rodar o SQL, rode só o último `insert into public.admins ...` de novo.
3. Copie `.env.example` para `.env` e preencha URL e anon key (Project Settings > API).
4. `npm install` e `npm run dev`.
5. Participantes: `/`  |  Admin: `/#/admin` (login, cadastro de conteúdos e estatísticas).
6. Publicando (Vercel/Netlify): configure as mesmas 2 variáveis de ambiente.
