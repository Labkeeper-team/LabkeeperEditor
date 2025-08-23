import { CompileSuccessResult, Program } from '../model/domain.ts';
import seg_input_ru1 from '../model/examples/1/seg_input_ru.json';
import seg_output_ru1 from '../model/examples/1/seg_output_ru.json';
import seg_input_en1 from '../model/examples/1/seg_input_en.json';
import seg_output_en1 from '../model/examples/1/seg_output_en.json';

import seg_input_ru2 from '../model/examples/2/seg_input_ru.json';
import seg_output_ru2 from '../model/examples/2/seg_output_ru.json';
import seg_input_en2 from '../model/examples/2/seg_input_en.json';
import seg_output_en2 from '../model/examples/2/seg_output_en.json';

import { Language } from './store/shared/dictionaries';

export class ExampleService {
    exampleForUnauthorize = (): [Program, CompileSuccessResult] => {
        const program = seg_input_ru1 as unknown as Program;
        const result = seg_output_ru1 as unknown as CompileSuccessResult;
        return [program, result];
    };

    exampleForQR = (
        version: string,
        language: Language
    ): [Program, CompileSuccessResult] => {
        if (version == 'v1') {
            let program: Program;
            let result: CompileSuccessResult;
            if (language == 'ru') {
                program = seg_input_ru1 as unknown as Program;
                result = seg_output_ru1 as unknown as CompileSuccessResult;
            } else {
                program = seg_input_en1 as Program;
                result = seg_output_en1 as unknown as CompileSuccessResult;
            }
            return [program, result];
        } else {
            throw new Error('wrong version');
        }
    };

    exampleForFrom = (
        from: string,
        language: Language
    ):
        | {
              program: Program;
              result: CompileSuccessResult;
          }
        | undefined => {
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
            return { program, result };
        }
    };
}
