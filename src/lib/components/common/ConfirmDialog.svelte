<script lang="ts">
	/**
	 * Confirmation modale accessible (`<dialog>` natif : focus piégé, Échap annule).
	 * Utilisée avant toute action irréversible (remplacer une carrière, importer).
	 */
	interface Props {
		title: string;
		message: string;
		confirmLabel: string;
		onConfirm: () => void;
		onCancel: () => void;
		danger?: boolean;
	}

	let { title, message, confirmLabel, onConfirm, onCancel, danger = false }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="confirm-title"
	aria-describedby="confirm-message"
	class="m-auto w-[min(32rem,90vw)] rounded-lg border border-line bg-surface p-6 text-ink shadow-lg backdrop:bg-ink/40"
	oncancel={(event) => {
		event.preventDefault();
		onCancel();
	}}
>
	<h2 id="confirm-title" class="text-xl text-primary">{title}</h2>
	<p id="confirm-message" class="mt-3 leading-relaxed">{message}</p>
	<div class="mt-6 flex justify-end gap-3">
		<button type="button" class="btn-secondary" onclick={onCancel}>Annuler</button>
		<button type="button" class={danger ? 'btn-danger' : 'btn-primary'} onclick={onConfirm}>
			{confirmLabel}
		</button>
	</div>
</dialog>
