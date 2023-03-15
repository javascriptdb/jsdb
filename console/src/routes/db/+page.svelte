<script lang="ts">
  import {onMount} from 'svelte';
  import {db} from '../../services/jsdb';
  import {buildRelativePath} from '../../services/routeUtils';
  import {page} from '$app/stores';
  import {goto} from '$app/navigation';
  import Document from './Document.svelte';

  let collections = [];

  onMount(async () => {
    const omitNames = ['users', 'bundles'];
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
  });

  async function fetchTableData(tableName) {
    if (tableName) {
      let rows = await db[tableName];
      let columns = [];
      console.log({rows, columns});
      return {rows, columns};
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
    const openDocs = JSON.parse(searchParams.get('openDocs') || '[]');
    openDocs.push(row.id);
    searchParams.set('openDocs', openDocs);
    await goto(buildRelativePath($page, '?' + searchParams.toString()));
  }

  onMount(async () => {
    await fetchTableData($page.url.searchParams.get('collection'));
  });
</script>
<div class="flex flex-row">
    <div class="flex max-w-xs bg-contrast m-2 p-2 rounded">
        <ul>
            {#each collections as collection}
                <li class="p-2 rounded hover:contrast-50 cursor-pointer">
                    <a href={buildRelativePath($page,`?collection=${collection}`)}>{collection}</a>
                </li>
            {/each}
        </ul>
    </div>

    <div class="flex-1">
        {#if $page.url.searchParams.has('collection')}
            {#await fetchTableData($page.url.searchParams.get('collection')) then tableData}
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
                                </td>
                                <td>{JSON.stringify(row)}</td>
                            </tr>
                        {/each}
                        </tbody>
                    </table>
                </div>
            {:catch error}
                Error fetching table data
            {/await}
        {/if}
    </div>

</div>

{#if $page.url.searchParams.has('openDocs')}
    {#each JSON.parse($page.url.searchParams.get('openDocs')) || [] as id}
        <Document {id} collection={$page.url.searchParams.get('collection')} let:document>
            {JSON.stringify(document)}
        </Document>
    {/each}
{/if}

