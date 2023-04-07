<script lang="ts">
    import {onMount} from 'svelte';
    import {db} from '../../services/jsdb';
    import {buildRelativePath} from '../../services/routeUtils';
    import {page} from '$app/stores';
    import {goto} from '$app/navigation';
    import Document from '../../lib/Document.svelte';
    import DocumentModal from "./DocumentModal.svelte";

    let collections = [];
    const paginationStep = 7;


    async function fetchCollections() {
        const omitNames = ['users', 'bundles'];
        collections = [];
        try {
            const allCollectionNames = await db.getTables();
            allCollectionNames.forEach((name, index) => {
                /*if(!omitNames.includes(name))*/
                collections.push(name);
            });
            collections = collections.sort();
        } catch (error) {
            alert('Error fetching table names.');
        }
    }

    async function fetchTableData(page) {
        const collection = page.url.searchParams.get('collection');
        const start = Number(page.url.searchParams.get('page') || 0) * paginationStep;
        const end = start + paginationStep;
        const filter = page.url.searchParams.get('filter');
        if (collection) {
            let rows, length;
            if(filter) {
                rows = await db[collection].filter(eval(filter)).slice(start, end);
                length = await db[collection].filter(eval(filter)).length;
            } else {
                rows = await db[collection].slice(start, end);
                length = await db[collection].length;
            }


            let columns = [];
            return {rows, columns, length};
        }
    }

    async function fillWithTestData() {
        const tableName = $page.url.searchParams.get('collection')
        for (let i = 0; i < 5; i++) {
            await db[tableName].push({
                testNumber: i,
                text: 'a'+1
            })
        }
    }

    async function copyMe(event) {
        const target = event.target;
        const copyText = target.innerText;
        try {
            await navigator.clipboard.writeText(copyText);
        } catch (e) {
            console.log(e);
        }
    }

    async function editRow(row) {
        const searchParams = new URLSearchParams($page.url.searchParams);
        const openDocs = new Set(JSON.parse(searchParams.get('openDocs') || '[]'));
        openDocs.add(row.id);
        searchParams.set('openDocs', JSON.stringify(Array.from(openDocs)));
        await goto(buildRelativePath($page, '?' + searchParams.toString()));
    }

    async function addCollection() {
        const collectionName = prompt('Enter new collection name');
        await db[collectionName].length;
        collections = [collectionName, ...collections];
        await goto(buildRelativePath($page, `?collection=${collectionName}`))
    }

    // Direction is 1 or -1
    function getPageUrl(page, direction) {
        const searchParams = new URLSearchParams(page.url.searchParams);
        const currentPage = Number(page.url.searchParams.get('page') || 0)
        const newPage = Math.max(currentPage + direction, 0);
        searchParams.set('page', newPage.toString());
        return buildRelativePath(page, '?' + searchParams.toString())
    }

    function addFilter(event) {
        const searchParams = new URLSearchParams($page.url.searchParams);
        searchParams.delete('page');
        searchParams.set('filter', event.target.value.toString());
        return goto(buildRelativePath($page, '?' + searchParams.toString()))
    }

    async function deleteRow(id) {
        const collection = $page.url.searchParams.get('collection');
        if(confirm(`Are you sure you want to delete document ${id}`)) {
            try {
                await db[collection].delete(id);
                await goto($page.url.toString())
            } catch (e) {
                alert('Error occurred');
                console.error(e);
            }
        }
    }

    onMount(async () => {
        await fetchCollections();
    });
</script>
<div class="flex flex-row">
    <div class="max-w-xs bg-contrast m-2 p-2 rounded">
        <ul>
            {#each collections as collection}
                <li class:font-bold={$page.url.searchParams.get('collection') === collection}
                    class="p-2 rounded hover:contrast-50 cursor-pointer">
                    <a href={buildRelativePath($page,`?collection=${collection}`)}>{collection}</a>
                </li>
            {/each}
        </ul>
        <button class="button-primary" on:click={addCollection}>Add collection</button>
        <button class="button-primary" on:click={fillWithTestData}>Fill with test data</button>
    </div>


    <div class="flex-1">
        <input on:change={addFilter} type="text" class="w-full text-black" placeholder="Enter filter function filter function, example:  'user=>user.name.includes('y')'">
        {#if $page.url.searchParams.has('collection')}
            {#await fetchTableData($page) then tableData}
                <div class="flex bg-contrast m-2 p-2 rounded">
                    <table>
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Data</th>
                        </tr>
                        </thead>
                        <tbody>
                        {#each tableData.rows as row}
                            <tr>
                                <td class="cursor-pointer">
                                    <svg on:click={()=>editRow(row)} xmlns="http://www.w3.org/2000/svg" fill="none"
                                         viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
                                         class="inline-block w-4 h-4">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"/>
                                    </svg>

                                    <span title="Click to copy" class="cursor-pointer" on:click={copyMe}>{row.id}</span>
                                    <span title="Click to copy" class="cursor-pointer" on:click={()=>deleteRow(row.id)}>Delete</span>
                                </td>
                                <td>{JSON.stringify(row)}</td>
                            </tr>
                        {/each}
                        </tbody>
                    </table>
                </div>
                <div>Number of records: {tableData.length}</div>
                {#if Number($page.url.searchParams.get('page')) > 0}
                    <a href={getPageUrl($page,-1)}>Previous page</a>
                {/if}
                {#if Number($page.url.searchParams.get('page')) * paginationStep < tableData.length}
                    <a href={getPageUrl($page,+1)}>Next page</a>
                {/if}
            {:catch error}
                Error fetching table data
            {/await}
        {/if}
    </div>

</div>

{#if $page.url.searchParams.has('openDocs')}
    {#each JSON.parse($page.url.searchParams.get('openDocs')) || [] as id}
        <Document {id} collection={$page.url.searchParams.get('collection')} let:document>
            <DocumentModal {id} {document} collection={$page.url.searchParams.get('collection')}/>
        </Document>
    {/each}
{/if}

