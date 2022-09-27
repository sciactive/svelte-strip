const fs = require("fs");
const { dirname, resolve, sep } = require("path");
const { preprocess } = require("svelte/compiler");
const sveltePreprocess = require("svelte-preprocess");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const glob = require("glob-promise");
const minimatch = require("minimatch");

const { typescript } = sveltePreprocess;

async function strip(filename, target, maps) {
  const { code, map } = await preprocess(
    (await fs.promises.readFile(filename)).toString(),
    [typescript()],
    {
      filename,
    }
  );

  await fs.promises.writeFile(
    target,
    code.replace(
      /(<script\s*?[^>]*?)\s*\blang\s*=\s*["'`]?ts["'`]?([^>]*>)/g,
      "$1$2"
    )
  );

  if (maps) {
    await fs.promises.writeFile(`${target}.map`, JSON.stringify(map));
  }
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
        let files = await glob(resolve(input, "**", globPattern), {});

        if (sep === "\\") {
          files = files.map((path) => path.replaceAll("/", sep));
        }

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
          await strip(infile, outfile, argv.maps);
        }
      } else if (stats.isFile() || stats.isFIFO()) {
        await makeDirectoryStructure(output);
        await strip(input, output, argv.maps);
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
