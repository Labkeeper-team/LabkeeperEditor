import {
    CompileSuccessResult,
    Program,
    TextOutputSegment,
} from '../model/domain.ts';
import seg_input_ru1 from '../model/examples/1/seg_input_ru.json';
import seg_output_ru1 from '../model/examples/1/seg_output_ru.json';
//import seg_input_en1 from '../model/examples/1/seg_input_en.json';
//import seg_output_en1 from '../model/examples/1/seg_output_en.json';

import seg_input_ru2 from '../model/examples/2/seg_input_ru.json';
import seg_output_ru2 from '../model/examples/2/seg_output_ru.json';
import seg_input_en2 from '../model/examples/2/seg_input_en.json';
import seg_output_en2 from '../model/examples/2/seg_output_en.json';

import { Language } from './store/shared/dictionaries';
import { Rpi } from '../model/rpi';

interface Lab {
    name: string;
    link: string;
}

interface Labs {
    labs: Lab[];
}

const LABS_PATH = 'mipt/labs.json';

export class ExampleService {
    rpi: Rpi;

    constructor(rpi: Rpi) {
        this.rpi = rpi;
    }

    exampleForUnauthorize = (): [Program, CompileSuccessResult] => {
        const program = seg_input_ru1 as unknown as Program;
        const result = seg_output_ru1 as unknown as CompileSuccessResult;
        return [program, result];
    };

    exampleForQR = async (
        version: string,
        language: Language
    ): Promise<
        { program: Program; result: CompileSuccessResult } | undefined
    > => {
        if (version == 'v1') {
            let program: Program;
            let result: CompileSuccessResult;
            if (language == 'ru') {
                program = seg_input_ru2 as unknown as Program;
                result = seg_output_ru2 as unknown as CompileSuccessResult;
            } else {
                program = seg_input_en2 as Program;
                result = seg_output_en2 as unknown as CompileSuccessResult;
            }

            await this.addLabs(program, result);

            return { program, result };
        } else {
            throw new Error('wrong version');
        }
    };

    exampleForFrom = async (
        from: string,
        language: Language
    ): Promise<
        | {
              program: Program;
              result: CompileSuccessResult;
          }
        | undefined
    > => {
        if (from === 'mipt') {
            let program: Program;
            let result: CompileSuccessResult;
            if (language == 'ru') {
                program = seg_input_ru2 as unknown as Program;
                result = seg_output_ru2 as unknown as CompileSuccessResult;
            } else {
                program = seg_input_en2 as Program;
                result = seg_output_en2 as unknown as CompileSuccessResult;
            }

            await this.addLabs(program, result);

            return { program, result };
        }
    };

    private addLabs = async (
        program: Program,
        result: CompileSuccessResult
    ) => {
        const response = await this.rpi.getS3FileRequest(LABS_PATH);

        if (response.isOk) {
            const labs = response.body as Labs;
            program.segments[program.segments.length - 1].text += labs.labs
                .map((lab) => `* [**${lab.name}**](${lab.link})`)
                .join('\n');
            if (
                result.segments[result.segments.length - 1].type !==
                'computational'
            ) {
                (
                    result.segments[
                        result.segments.length - 1
                    ] as TextOutputSegment
                ).text += labs.labs
                    .map((lab) => `* [**${lab.name}**](${lab.link})`)
                    .join('\n');
            }
        }
    };
}
