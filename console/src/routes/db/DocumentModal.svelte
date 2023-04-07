<script>
    import {db} from "../../services/jsdb";

    export let document, collection, id;
    let value = JSON.stringify(document, (key, value) => {
        if (key === 'id') return undefined;
        return value;
    });

    async function save() {
        try{
            await db[collection].set(id, JSON.parse(value))
        } catch (e){
            alert('Error occurred.')
            console.error(e);
        }
    }
</script>

<div class="bg-contrast fixed top-0 bottom-0 left-2/3 right-0 shadow-2xl p-4">
    <textarea bind:value class="h-fit text-black w-full"/>
    <button class="button-primary" on:click={save}>Save</button>
</div>
