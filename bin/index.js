const fs = require("fs");
const { dirname, resolve, sep } = require("path");
const { preprocess } = require("svelte/compiler");
const sveltePreprocess = require("svelte-preprocess");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const glob = require("glob-promise");
const minimatch = require("minimatch");
const Generator = require("svelte-dts/dist/generator");
const { transpileModule } = require("typescript");

const { getTagInfo } = require("svelte-preprocess/dist/modules/tagInfo");
const { concat } = require("svelte-preprocess/dist/modules/utils");
const {
  prepareContent,
} = require("svelte-preprocess/dist/modules/prepareContent");

const { typescript } = sveltePreprocess;

async function strip(filename, target, maps, declarations) {
  const source = (await fs.promises.readFile(filename)).toString();
  const output = await preprocess(
    source,
    [
      // sveltePreprocess({
      //   typescript({ content }) {
      //     console.log({ content });
      //     const pre = typescript({ reportDiagnostics: true });
      //     console.log({ pre });
      //     const output = pre.script(content, {
      //       declarations: true,
      //     });
      //     console.log({ output, declarations: output.declarations });
      //     return {
      //       code: output.outputText,
      //       map: output.sourceMapText,
      //     };
      //   },
      // }),
      // typescript({ reportDiagnostics: true }),
      {
        async script(svelteFile) {
          const { transformer } = await import(
            "svelte-preprocess/dist/transformers/typescript.js"
          );
          const options = {
            reportDiagnostics: true,
            compilerOptions: {
              declarations: true,
            },
          };
          let { content, markup, filename, attributes, lang, dependencies } =
            await getTagInfo(svelteFile);

          if (lang !== "typescript") {
            return { code: content };
          }

          content = prepareContent({ options, content });

          const transformed = await transformer({
            content,
            markup,
            filename,
            attributes,
            options,
          });

          console.log(transformed);

          return {
            ...transformed,
            dependencies: concat(dependencies, transformed.dependencies),
          };
        },
      },
    ],
    {
      filename,
    }
  );

  console.log({ output });
  const { code, map } = output;

  await fs.promises.writeFile(
    target,
    code.replace(/<script lang="ts">/g, () => "<script>")
  );

  if (maps) {
    await fs.promises.writeFile(`${target}.map`, JSON.stringify(map));
  }

  // if (declarations) {
  //   const generator = new Generator.default(filename, {
  //     output: `${target}.d.ts`,
  //     extensions: [".svelte"],
  //   });
  //   await generator.read();
  //   await generator.write();
  // }
}

async function makeDirectoryStructure(filename) {
  await fs.promises.mkdir(dirname(filename), { recursive: true });
}

yargs(hideBin(process.argv))
  .command(
    "strip <input> <output>",
    "Strip types from Svelte files.",
    function (yargs) {
      return yargs
        .positional("input", {
          type: "string",
          describe:
            "The input file or directory. You can give it a single file and it will output a single file, or you can give it a directory and it will process all Svelte files in the directory and output the same structure into the output directory.",
          demandOption: true,
          requiresArg: true,
        })
        .positional("output", {
          type: "string",
          describe: "The output file or directory.",
          demandOption: true,
          requiresArg: true,
        })
        .options({
          maps: {
            alias: "m",
            type: "boolean",
            description: "Whether to include source maps.",
            default: true,
          },
          declarations: {
            alias: "d",
            type: "boolean",
            description: "Whether to include declaration files.",
            default: true,
          },
          "glob-pattern": {
            alias: "p",
            type: "string",
            description: "Glob pattern to match Svelte files.",
            default: "*.svelte",
          },
          ignore: {
            alias: "i",
            type: "array",
            description: "Directories to ignore.",
            default: ["**/node_modules/**"],
          },
        });
    },
    async (argv) => {
      const { input, output, globPattern, ignore } = argv;
      const stats = await fs.promises.stat(input);

      if (stats.isDirectory()) {
        const files = await glob(resolve(input, "**", globPattern));
        const inpath = resolve(input);
        for (const file of files) {
          if (
            ignore.find((pattern) =>
              minimatch(file, pattern, { matchBase: false })
            )
          ) {
            continue;
          }

          const infile = file;
          const slice = file.slice(inpath.length);
          const outfile = resolve(
            output,
            slice.startsWith(sep) ? slice.slice(sep.length) : slice
          );

          await makeDirectoryStructure(outfile);
          await strip(infile, outfile, argv.maps, argv.declarations);
        }
      } else if (stats.isFile() || stats.isFIFO()) {
        await makeDirectoryStructure(output);
        await strip(input, output, argv.maps, argv.declarations);
      } else {
        console.error("Input does not seem to be a file, directory, or pipe.");
        process.exit(1);
      }

      process.exit(0);
    }
  )
  .completion()
  .version()
  .help().argv;
