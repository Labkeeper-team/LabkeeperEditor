import { useCompiledSegments } from '../../store/selectors/program.ts';
import { ViewResult } from '../../pages/project/viewer/result/view';
import { render } from '@testing-library/react';
import preview from 'jest-preview';

let testSegment = {
    id: 0,
    type: 'computational',
    statements: [
        {
            type: 'assignment',
            variable: 'a',
            array: { array: [{ value: '1', infl: '1' }] },
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

jest.mock('react-redux', () => {
    return {
        useSelector: (arg) => {
            if (arg === useCompiledSegments) {
                return [testSegment];
            }
        },
    };
});

test('Simple detailed segment', () => {
    testSegment = {
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
            {
                type: 'calculation',
                variable: 'b',
                array: {
                    array: [
                        {
                            value: '100',
                            infl: '20',
                        },
                        {
                            value: '100',
                            infl: '20',
                        },
                    ],
                },
                assignment: 'a^2',
                assignmentWithValues: ['10^2', '10^2'],
                inflAssignmentGeneralFormula:
                    'sqrt(((partial b)/(partial a)*sigma(a))^2)',
                inflAssignment:
                    'sqrt(1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1)',
                inflAssignmentWithValues: [
                    'sqrt(4*10^2*1^2)',
                    'sqrt(4*10^2*1^2)',
                ],
            },
        ],
    };
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('Simple array', () => {
    testSegment = {
        id: 0,
        type: 'computational',
        statements: [
            {
                type: 'assignment',
                variable: 'a',
                array: { array: [{ value: '1', infl: '1' }] },
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
                        {
                            value: '100',
                            infl: '20',
                        },
                    ],
                },
                assignment: 'a^2',
                assignmentWithValues: ['10^2', '10^2'],
                inflAssignmentGeneralFormula:
                    'sqrt(((partial b)/(partial a)*sigma(a))^2)',
                inflAssignment: 'sqrt(4*a^2*sigma(a)^2)',
                inflAssignmentWithValues: [
                    'sqrt(4*10^2*1^2)',
                    'sqrt(4*10^2*1^2)',
                ],
            },
        ],
    };
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});
