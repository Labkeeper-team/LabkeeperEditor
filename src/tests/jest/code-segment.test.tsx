import { render } from '@testing-library/react';
import preview from 'jest-preview';
import { ViewResult } from '../../view/pages/project/viewer/result/view';

import seg1 from './__segments__/seg1.json';
import seg2 from './__segments__/seg2.json';
import seg3 from './__segments__/seg3.json';
import seg4 from './__segments__/seg4.json';
import seg5 from './__segments__/seg5.json';
import seg6 from './__segments__/seg6.json';
import seg7 from './__segments__/seg7.json';
import seg8 from './__segments__/seg8.json';
import seg9 from './__segments__/seg9.json';
import seg10 from './__segments__/seg10.json';
import seg11 from './__segments__/seg11.json';
import seg12 from './__segments__/seg12.json';
import seg13 from './__segments__/seg13.json';
import seg15 from './__segments__/seg15.json';
import seg16 from './__segments__/seg16.json';
import seg17 from './__segments__/seg17.json';
import seg18 from './__segments__/seg18.json';
import seg19 from './__segments__/seg19.json';
import seg20 from './__segments__/seg20.json';
import seg21 from './__segments__/seg21.json';
import seg22 from './__segments__/seg22.json';
import seg23 from './__segments__/seg23.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testSegment: any = {
    id: 0,
    type: 'computational',
    statements: [
        {
            type: 'assignment',
            variable: 'a',
            array: { array: [{ value: '10', infl: '1' }] },
        },
        {
            type: 'file',
            url: 'http://files.mipt.io.s3.localhost.localstack.cloud:4566/generated/user-1/project-2/2_0_.png',
        },
        {
            type: 'calculation',
            variable: 'b',
            array: {
                array: [
                    {
                        value: '100',
                        infl: '20',
                    },
                ],
            },
            assignment: 'a^2',
            assignmentWithValues: ['10^2'],
            inflAssignmentGeneralFormula:
                'sqrt(((partial b)/(partial a)*sigma(a))^2)',
            inflAssignment: 'sqrt(4*a^2*sigma(a)^2)',
            inflAssignmentWithValues: ['sqrt(4*10^2*1^2)'],
        },
    ],
};

jest.mock('../../main.tsx', () => ({
    controller: {
        onFocusSegmentRequest: jest.fn(),
        onBlurSegmentRequest: jest.fn(),
    },
}));
let i = 0;
jest.mock('react-redux', () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
        useDispatch: () => (e?: any) => {},
        useSelector: () => {
            if (i === 0) {
                i++;
                return 1;
            }
            if (i === 1) {
                i++;
                return testSegment;
            }
            if (i === 2) {
                i++;
                return false;
            }
            if (i === 3) {
                i++;
                return false;
            }
            if (i === 4) {
                i = 1;
                return 1;
            }
        },
    };
});

const TestSegment = () => (
    <div
        style={{
            position: 'absolute',
            width: '100%',
            borderStyle: 'dashed',
            borderColor: 'black',
        }}
    >
        <ViewResult />
    </div>
);

test('Simple real segment', () => {
    testSegment = seg1;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('Beta particles', () => {
    testSegment = seg2;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('Young module', () => {
    testSegment = seg3;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('Polynomial power', () => {
    testSegment = seg4;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('Reagents mass', () => {
    testSegment = seg5;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('underlining fix', () => {
    testSegment = seg6;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('seg7', () => {
    testSegment = seg7;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('negative power', () => {
    testSegment = seg8;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('down sigma', () => {
    testSegment = seg9;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('down power', () => {
    testSegment = seg10;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('alias self', () => {
    testSegment = seg11;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('shrink formula', () => {
    testSegment = seg12;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('down sigma 2', () => {
    testSegment = seg13;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('two symbols after', () => {
    testSegment = seg15;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

function hiddenSegment(
    hideAssignmentWithValues: boolean,
    hideArray: boolean,
    hideGeneralFormula: boolean,
    hideInflAssignment: boolean,
    hideInflAssignmentWithValues: boolean
) {
    const res: {
        id: number;
        type: 'computational';
        statements: {
            type: 'calculation';
            variable: string;
            array: { array: { value: string; infl: string }[] } | undefined;
            assignment: string;
            assignmentWithValues: string[] | undefined;
            inflAssignmentGeneralFormula: string | undefined;
            inflAssignment: string | undefined;
            inflAssignmentWithValues: string[] | undefined;
        }[];
    } = {
        id: 0,
        type: 'computational',
        statements: [
            {
                type: 'calculation',
                variable: 'b',
                array: {
                    array: [
                        {
                            value: '100',
                            infl: '20',
                        },
                    ],
                },
                assignment: 'a^2',
                assignmentWithValues: ['10^2'],
                inflAssignmentGeneralFormula:
                    'sqrt(((partial b)/(partial a)*sigma(a))^2)',
                inflAssignment: 'sqrt(4*a^2*sigma(a)^2)',
                inflAssignmentWithValues: ['sqrt(4*10^2*1^2)'],
            },
        ],
    };

    if (hideArray) {
        res.statements[0].array = undefined;
    }
    if (hideAssignmentWithValues) {
        res.statements[0].assignmentWithValues = undefined;
    }
    if (hideGeneralFormula) {
        res.statements[0].inflAssignmentGeneralFormula = undefined;
    }
    if (hideInflAssignment) {
        res.statements[0].inflAssignment = undefined;
    }
    if (hideInflAssignmentWithValues) {
        res.statements[0].inflAssignmentWithValues = undefined;
    }

    return res;
}

test('hidden 1', () => {
    testSegment = hiddenSegment(false, true, true, true, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 2', () => {
    testSegment = hiddenSegment(false, false, true, true, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 3', () => {
    testSegment = hiddenSegment(false, false, false, true, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 4', () => {
    testSegment = hiddenSegment(false, false, false, false, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 5', () => {
    testSegment = hiddenSegment(false, false, false, false, false);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 6', () => {
    testSegment = hiddenSegment(false, false, true, false, false);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 7', () => {
    testSegment = hiddenSegment(true, false, false, false, false);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 8', () => {
    testSegment = hiddenSegment(false, true, false, false, false);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 9', () => {
    testSegment = hiddenSegment(false, false, false, true, false);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 10', () => {
    testSegment = hiddenSegment(false, false, false, true, false);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 11', () => {
    testSegment = hiddenSegment(false, false, false, false, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 12', () => {
    testSegment = hiddenSegment(true, true, true, true, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 13', () => {
    testSegment = hiddenSegment(true, true, false, true, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 14', () => {
    testSegment = hiddenSegment(true, true, false, false, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 15', () => {
    testSegment = hiddenSegment(true, false, true, false, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden 16', () => {
    testSegment = hiddenSegment(true, false, false, false, true);
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden-17', () => {
    testSegment = seg22;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('hidden-18', () => {
    testSegment = seg23;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('sum with skipped valued assignment', () => {
    testSegment = seg16;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('sum2', () => {
    testSegment = seg17;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('max function render', () => {
    testSegment = seg18;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('least_squares', () => {
    testSegment = seg19;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('range', () => {
    testSegment = seg20;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('slice', () => {
    testSegment = seg21;
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});
