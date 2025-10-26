import { ViewResult } from '../../view/pages/project/viewer/result/view';
import { render } from '@testing-library/react';
import preview from 'jest-preview';

let testSegment = {
    id: 0,
    type: 'computational',
    statements: [
        {
            type: 'assignment',
            variable: 'a',
            array: { array: [{ value: '10', infl: '1' }] },
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

let i = 0;
jest.mock('../../main.tsx', () => ({
    controller: {
        onFocusSegmentRequest: jest.fn(),
        onBlurSegmentRequest: jest.fn(),
    },
}));

jest.mock('react-redux', () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
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

test('Simple segment', () => {
    testSegment = {
        id: 0,
        type: 'computational',
        statements: [
            {
                type: 'assignment',
                variable: 'a',
                array: { array: [] },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: { array: [{ value: '10', infl: '1' }] },
            },
            {
                type: 'assignment',
                variable: 'a_f',
                array: { array: [{ value: '10', infl: '1' }] },
            },
            {
                type: 'assignment',
                variable: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                array: { array: [{ value: '10', infl: '1' }] },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        { value: '1000000000000000000000000', infl: '10^-100' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a_a_d_d_d_sc_d_d',
                array: {
                    array: [
                        {
                            value: '1000000000000000000000000',
                            infl: '10^-1000000000000000',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'my_biba',
                array: {
                    array: [
                        {
                            value: '-10000000000000000000000000000000000000000000000000000000000',
                            infl: '100000000000000000000000000000000000000000000000000000000000000^-100000000000000000000000000',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'my_biba',
                array: {
                    array: [
                        {
                            value: '-1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '100000000000000000000000000000000000000000000000000000000000000^-100000000000000000000000000',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        { value: '10', infl: '1' },
                        { value: '10', infl: '1' },
                        { value: '10', infl: '1' },
                        { value: '10', infl: '1' },
                        { value: '10', infl: '1' },
                        { value: '10', infl: '1' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                        { value: '1000000000000000000', infl: '1000000000000' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '1000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '100000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                        {
                            value: '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                            infl: '1000000000000000000000',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a_f_g',
                array: { array: [{ value: '2.3*10^20', infl: '1.0*10^21' }] },
            },
            {
                type: 'assignment',
                variable: '_f_g',
                array: { array: [{ value: '2.3*10^20', infl: '1.0*10^21' }] },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                        { value: '221', infl: '3' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'electron_mass',
                array: {
                    array: [
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '4' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '5' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '4' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                        { value: '123', infl: '3' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'electron_mass_and_without_something',
                array: {
                    array: [
                        {
                            value: '2.34473711*10^20',
                            infl: '12332.03221*10^21',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable:
                    'longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong',
                array: {
                    array: [
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable:
                    'longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong',
                array: {
                    array: [
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable:
                    'longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong',
                array: {
                    array: [
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '11', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                        { value: '112222222222222.33333333333333', infl: '1' },
                    ],
                },
            },
            {
                type: 'assignment',
                variable:
                    'longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong',
                array: {
                    array: [
                        {
                            value: '111111111111111111111111111111111',
                            infl: '111111111111111111111111111111',
                        },
                        {
                            value: '111111111111111111111111111111111',
                            infl: '111111111111111111111111111111',
                        },
                    ],
                },
            },
            {
                type: 'assignment',
                variable: 'a',
                array: {
                    array: [
                        {
                            value: '1',
                            infl: '0',
                        },
                        {
                            value: '2',
                            infl: '0',
                        },
                        {
                            value: '3',
                            infl: '0',
                        },
                    ],
                },
            },
        ],
    };
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('greek-test', () => {
    testSegment = {
        id: 0,
        type: 'computational',
        statements: [
            {
                type: 'assignment',
                variable: 'alpha',
                array: { array: [{ value: '1.0', infl: '0.1' }] },
            },
            {
                type: 'assignment',
                variable: 'alpha_t',
                array: { array: [{ value: '3.0', infl: '0.5' }] },
            },
            {
                type: 'assignment',
                variable: 'alpha_beta',
                array: { array: [{ value: '5.0', infl: '0.9' }] },
            },
        ],
    };
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});

test('lots of _', () => {
    testSegment = {
        id: 0,
        type: 'computational',
        statements: [
            {
                type: 'assignment',
                variable: 'biba_boba_two',
                array: { array: [{ value: '1.0', infl: '0.1' }] },
            },
            {
                type: 'assignment',
                variable: 'a__b',
                array: { array: [{ value: '1.0', infl: '0.1' }] },
            },
            {
                type: 'assignment',
                variable: 'a_____b',
                array: { array: [{ value: '1.0', infl: '0.1' }] },
            },
            {
                type: 'assignment',
                variable: 'a__b__',
                array: { array: [{ value: '1.0', infl: '0.1' }] },
            },
            {
                type: 'assignment',
                variable: '___a__b',
                array: { array: [{ value: '1.0', infl: '0.1' }] },
            },
            {
                type: 'assignment',
                variable: 'biba_boba_two_three',
                array: { array: [{ value: '1.0', infl: '0.1' }] },
            },
        ],
    };
    const segment = render(<TestSegment />);
    preview.debug();
    expect(segment).toMatchSnapshot();
});
