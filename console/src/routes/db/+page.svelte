<script lang="ts">
    import {onMount} from "svelte";
    import {db} from "../../services/jsdb";
    let names;

    onMount(async () => {
        names = await db.getTables();
    })
</script>

{JSON.stringify(names)}