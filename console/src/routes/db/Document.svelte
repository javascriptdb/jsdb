<script>
    import {db} from "../../services/jsdb";

    export let id;
    export let collection;
    export let document;

    $:{
        !async function(){
            document = await db[collection][id];
        }()
    }
</script>

<slot {document}/>
