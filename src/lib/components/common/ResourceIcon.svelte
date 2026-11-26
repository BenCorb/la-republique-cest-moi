<script lang="ts">
	import { identityOf, type Identity } from './identity.ts';

	/**
	 * Icône d'identité d'une ressource, d'une jauge ou d'un groupe (P3-26) :
	 * icône colorée seule, ou blanche sur pastille ronde (`disc`). Décorative par
	 * défaut ; avec `label`, elle porte un nom accessible.
	 */
	interface Props {
		identity: string | Identity | null;
		size?: 'xs' | 'sm' | 'md' | 'lg';
		disc?: boolean;
		label?: string;
	}

	let { identity, size = 'sm', disc = false, label }: Props = $props();
	const resolved = $derived(typeof identity === 'string' ? identityOf(identity) : identity);

	const iconSize = { xs: 'size-3', sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const;
	const discSize = { xs: 'size-5', sm: 'size-6', md: 'size-8', lg: 'size-11' } as const;
</script>

{#if resolved}
	{#if disc}
		<span
			class="inline-grid shrink-0 place-items-center rounded-full text-surface {discSize[size]}"
			style:background={resolved.color}
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : 'true'}
		>
			<resolved.icon class={iconSize[size]} aria-hidden="true" />
		</span>
	{:else}
		<span
			class="inline-flex shrink-0"
			style:color={resolved.color}
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : 'true'}
		>
			<resolved.icon class={iconSize[size]} aria-hidden="true" />
		</span>
	{/if}
{/if}
