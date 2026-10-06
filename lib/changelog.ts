// Novidades de atualização — aparecem em /dashboard/novidades e acendem o
// pontinho no menu hambúrguer até a pessoa abrir a página.
//
// Pra publicar uma novidade nova: adicione um item NO TOPO da lista (o primeiro
// é sempre o mais recente). O `id` precisa ser único — é ele que decide se o
// pontinho de "novo" aparece de novo.

export type ChangeKind = 'novo' | 'melhoria' | 'correcao' | 'alteracao';

export interface ChangelogEntry {
  id: string;
  date: string; // AAAA-MM-DD
  title: string;
  kind: ChangeKind;
  items: string[];
}

export const KIND_LABEL: Record<ChangeKind, string> = {
  novo: 'Novo',
  melhoria: 'Melhoria',
  correcao: 'Correção',
  alteracao: 'Alteração',
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-10-05-onboarding-saude-duplicar',
    date: '2026-10-05',
    title: 'Primeiros passos, checagem de saúde e duplicar painel',
    kind: 'novo',
    items: [
      'Servidor novo agora ganha um assistente de 2 perguntas que já cria o primeiro painel, em vez de tela em branco.',
      'Aviso no topo do dashboard quando um canal ou cargo de um painel foi apagado no Discord.',
      'Duplicar um painel inteiro para outro servidor que você administra, com um clique.',
    ],
  },
  {
    id: '2026-10-01-suporte',
    date: '2026-10-01',
    title: 'Suporte em página separada',
    kind: 'novo',
    items: [
      'Nova página /suporte, fora de qualquer servidor: basta estar logado para abrir e acompanhar chamados.',
      'Você pode indicar (opcional) de qual servidor é o assunto.',
    ],
  },
  {
    id: '2026-09-30-conquistas',
    date: '2026-09-30',
    title: 'Conquistas: card para compartilhar',
    kind: 'novo',
    items: [
      'Nova aba Conquistas no servidor, com um card pronto para postar: "Já atendemos 1.234 tickets, nota média 4,9".',
      'Baixe em formato horizontal ou quadrado, ou compartilhe direto pelo celular.',
      'Opção de mostrar o logo e o nome do seu servidor na faixa da página inicial (com aprovação da equipe).',
    ],
  },
  {
    id: '2026-09-30-menu',
    date: '2026-09-30',
    title: 'Menu novo e Suporte sem entrar em servidor',
    kind: 'novo',
    items: [
      'Menu hambúrguer na tela de servidores, com Início, Servidores, Suporte e Novidades.',
      'Suporte agora abre direto do menu: é só escolher o servidor, sem precisar entrar nele.',
      'Seletor de idioma dentro do menu.',
    ],
  },
  {
    id: '2026-09-30-avaliacao',
    date: '2026-09-30',
    title: 'Aba Avaliação nos painéis',
    kind: 'novo',
    items: [
      'Ligue ou desligue o pedido de avaliação do atendimento direto pelo dashboard.',
      'Escolha o canal onde o resumo de cada avaliação é publicado.',
      'Prévia de como o cliente vê a avaliação, do pedido ao resumo no canal.',
    ],
  },
  {
    id: '2026-09-29-painel-interno',
    date: '2026-09-29',
    title: 'Painel interno do ticket pelo dashboard',
    kind: 'novo',
    items: [
      'Nova aba "Painel interno": personalize o título e a mensagem de boas-vindas de dentro do ticket.',
      'Escolha quais elementos aparecem: avatar, atendente, motivo, tempo de espera e botões.',
      'Prévia ao vivo, com animação, enquanto você edita.',
    ],
  },
  {
    id: '2026-09-29-ticket-direto',
    date: '2026-09-29',
    title: 'Tickets abrem direto',
    kind: 'alteracao',
    items: [
      'O modal de motivo e a escolha de urgência foram removidos.',
      'Um sistema novo e melhor de triagem está a caminho. O formulário personalizado (VIP) continua funcionando normalmente.',
    ],
  },
  {
    id: '2026-09-28-visual',
    date: '2026-09-28',
    title: 'Visual novo do site',
    kind: 'melhoria',
    items: [
      'Fundo espacial animado em todo o site.',
      'Nova animação de borda nos cards, sem a linha que cruzava o card.',
      'Páginas Recursos e Comandos, com animações de entrada.',
      'Prévias no estilo do Discord nos cards da página inicial.',
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id || '';
