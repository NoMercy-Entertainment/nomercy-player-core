// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { CastSenderTranslationKey } from './en';

export default {
	'plugin.cast-sender.unavailable': 'Трансляція недоступна на цьому пристрої.',
	'plugin.cast-sender.connecting': 'Підключення до {device}…',
	'plugin.cast-sender.connected': 'Трансляція на {device}',
	'plugin.cast-sender.disconnected': 'Від’єднано від {device}',
	'plugin.cast-sender.error.session-failed': 'Не вдалося розпочати сеанс трансляції.',
	'plugin.cast-sender.error.load-failed': 'Пристрій трансляції відхилив медіафайл.',
	'plugin.cast-sender.error.generic': 'Сталася помилка трансляції.',
	'plugin.cast-sender.action.connect': 'Трансляція',
	'plugin.cast-sender.action.disconnect': 'Зупинити трансляцію',
	'plugin.cast-sender.state.buffering': 'Буферизація',
	'plugin.cast-sender.state.playing': 'Відтворюється на {device}',
	'plugin.cast-sender.state.paused': 'Призупинено на {device}',
} satisfies Record<CastSenderTranslationKey, string>;
