<script lang="ts">
  export let name = "World";
  export let world: boolean | null = true;
</script>

<div>Hello, {world ? name : ""}!</div>
