<script lang="ts" generics="T extends string = string">
  export let name: T = "World" as T;
  export let world: boolean | null = true;
</script>

<div>Hello, {world ? name : ""}!</div>
