// tslint:disable: no-console

import { promises as fs } from 'fs';

import { generateMinimalQueryList } from '../framework/generate_minimal_query_list.js';
import { TestSuiteListingEntry } from '../framework/listing.js';
import { TestLoader } from '../framework/loader.js';
import { listing } from '../suites/cts/index.js';

function usage(rc: number): void {
  console.error(`\
Usage:
  tools/gen_wpt_cts_html TEMPLATE_FILE OUTPUT_FILE [EXPECTATIONS_FILE PREFIX SUITE]
  tools/gen_wpt_cts_html templates/cts.html out-wpt/cts.html
  tools/gen_wpt_cts_html ./out-wpt/cts.html templates/cts.html myexpectations.txt 'path/to/cts.html?q=' cts

where myexpectations.txt is a file containing a list of WPT paths to suppress, e.g.:

  path/to/cts.html?q=cts:a/bar:bar1={"x":1}
  path/to/cts.html?q=cts:a/bar:bar1={"x":3}
`);
  process.exit(rc);
}

if (process.argv.length !== 4 && process.argv.length !== 7) {
  usage(0);
}
const outFile = process.argv[2];
const templateFile = process.argv[3];

(async () => {
  if (process.argv.length === 7) {
    const expectationsFile = process.argv[4];
    const prefix = process.argv[5];
    const suite = process.argv[6];

    const expectationLines = (await fs.readFile(expectationsFile, 'utf8')).split('\n');

    const expectations: string[] = [];
    for (const exp of expectationLines) {
      if (!exp) continue;
      if (!exp.startsWith(prefix)) {
        throw new Error('All input lines must start with PREFIX. ' + exp);
      }

      const expectation = exp.substring(prefix.length);
      expectations.push(expectation);
    }

    const loader = new TestLoader();
    const files = await loader.loadTestsFromCmdLine([suite + ':']);

    const lines = await generateMinimalQueryList(files, expectations);
    await generateFile(lines);
  } else {
    const entries = (await listing) as TestSuiteListingEntry[];
    const lines = entries
      // Exclude READMEs.
      .filter(l => l.path.length !== 0 && !l.path.endsWith('/'))
      .map(l => l.path);
    await generateFile(lines);
  }
})();

async function generateFile(lines: string[]): Promise<void> {
  let result = '';
  result += '<!-- AUTO-GENERATED - DO NOT EDIT. See gen_wpt_cts_html.ts. -->\n';

  result += await fs.readFile(templateFile, 'utf8');
  result += '\n';

  for (const line of lines) {
    result += `<meta name=variant content='?q=${line}'>\n`;
  }

  await fs.writeFile(outFile, result);
}
