import { SvelteComponentTyped } from "svelte";

declare module 'svelte-strip' {
	interface TestProps {
		thing: 'this' | 'that';
	}

	class Test extends SvelteComponentTyped<
		TestProps,
		{  },
		{  }
	> {}

	export default Test;
}

