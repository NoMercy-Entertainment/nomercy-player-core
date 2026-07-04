// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Portuguese core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'pt',
 *   translations: {
 *     ...defaultTranslations,
 *     pt: ptTranslations,
 *   },
 * });
 */
export const ptTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Sem conexão com a Internet.',
	'core.network.timeout': 'Tempo de conexão expirado. Tentando novamente…',
	'core.network.serverError': 'O servidor está tendo problemas. Tente novamente em um momento.',
	'core.network.notFound': 'Esse conteúdo não foi encontrado.',
	'core.network.rateLimited': 'Muitas solicitações. Por favor, desacelere.',

	// Auth
	'core.auth.unauthenticated': 'Faça login novamente para atualizar sua sessão.',
	'core.auth.forbidden': 'Sua conta não tem acesso a este conteúdo.',
	'core.auth.refreshFailed': 'Não foi possível atualizar sua sessão. Faça login novamente.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Toque ou clique em qualquer lugar para iniciar a reprodução.',
	'core.policy.userGestureRequired': 'Toque para ativar o áudio.',
	'core.policy.pipDenied': 'Imagem em imagem não é permitida neste contexto.',
	'core.policy.fullscreenDenied': 'Tela inteira não é permitida neste contexto.',
	'core.policy.wakeLockDenied': 'A tela pode escurecer durante a reprodução.',

	// Media
	'core.media.unsupported': 'Esse formato não é suportado pelo seu navegador.',
	'core.media.decodeFailed': 'Falha na reprodução — alternando para a próxima fonte disponível.',
	'core.media.allDecodeFailed': 'Nenhuma fonte reproduzível disponível para este conteúdo.',

	// DRM
	'core.drm.outputProtection': 'Seu display não atende aos requisitos de proteção para este conteúdo.',
	'core.drm.licenseFailed': 'Não foi possível obter uma licença para este conteúdo.',
	'core.drm.keySystemUnsupported': 'Seu navegador não suporta o sistema de proteção necessário.',

	// State / dev
	'core.state.queueEmpty': 'Não há nada na fila.',
	'core.state.notReady': 'O player ainda não está pronto.',

	// A11y announcements
	'core.a11y.playing': 'Reproduzindo {title}',
	'core.a11y.paused': 'Pausado',
	'core.a11y.stopped': 'Parado',
	'core.a11y.seeking': 'Buscando {time}',
	'core.a11y.trackChange': 'Agora reproduzindo {title}',
	'core.a11y.error': 'Ocorreu um erro durante a reprodução',
	'core.a11y.muted': 'Silenciado',
	'core.a11y.unmuted': 'Som ativado',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Reprodução pausada — outra aba agora está reproduzindo.',
	'plugin.media-session.unsupported': 'Os controles de mídia do SO não estão disponíveis neste navegador.',
};

export default ptTranslations;
