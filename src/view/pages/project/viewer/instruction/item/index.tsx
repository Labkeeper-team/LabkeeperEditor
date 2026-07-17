import { Typography } from '../../../../../components/typography';
import { colors } from '../../../../../styles/colors';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../store/selectors/translations.ts';
import { InstructionItem } from '../../../../../../model/help';

export const InstructionItemComponent = ({
    item,
}: {
    item: InstructionItem;
}) => {
    const dictionary = useSelector(useDictionary);
    const hasImage = Boolean(item.image);
    const hasWikiLink = Boolean(item.ending && item.wikiLink);
    const renderPointContent = (point: string) => {
        if (!point.includes('```')) {
            return (
                <Typography text={point} color={colors.gray10} type="body" />
            );
        }

        const parts = point.split(/(```[^`]+```)/g).filter(Boolean);

        return (
            <div
                style={{
                    color: colors.gray10,
                    fontSize: '13px',
                    lineHeight: '16px',
                    userSelect: 'none',
                }}
            >
                {parts.map((part, idx) => {
                    const codeMatch = part.match(/^```([^`]+)```$/);
                    if (!codeMatch) {
                        return <span key={idx}>{part}</span>;
                    }

                    return (
                        <code
                            key={idx}
                            style={{
                                backgroundColor: colors.gray40,
                                border: `1px solid ${colors.gray30}`,
                                borderRadius: '4px',
                                padding: '1px 6px',
                                fontFamily:
                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                fontSize: '12px',
                                lineHeight: '16px',
                            }}
                        >
                            {codeMatch[1]}
                        </code>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 5,
                marginTop: '-28px',
                paddingLeft: '24px',
                paddingRight: hasImage ? undefined : '24px',
                height: '100%',
                alignItems: 'center',
                backgroundColor: colors.gray60,
                borderRadius: '8px',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    flex: hasImage ? 1 : undefined,
                    width: hasImage ? undefined : '100%',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        overflow: 'auto',
                        maxHeight: '160px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${colors.gray40} transparent`,
                    }}
                    className="custom-scrollbar"
                >
                    <Typography
                        text={item.title}
                        color={colors.gray10}
                        type="body-large"
                    />
                    {item.points.map((point, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-start',
                            }}
                        >
                            <div
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: colors.buttonActionBlue,
                                    marginTop: '8px',
                                    flexShrink: 0,
                                }}
                            />
                            {renderPointContent(point)}
                        </div>
                    ))}
                    {hasWikiLink ? (
                        <div
                            style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-start',
                                flexWrap: 'nowrap',
                            }}
                        >
                            <div
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: colors.buttonActionBlue,
                                    marginTop: '8px',
                                    flexShrink: 0,
                                }}
                            />
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '4px',
                                    alignItems: 'center',
                                    flexWrap: 'nowrap',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <Typography
                                    text={item.ending}
                                    color={colors.gray10}
                                    type="body"
                                    style={{ whiteSpace: 'nowrap' }}
                                />
                                <a
                                    href={item.wikiLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        color: colors.buttonActionBlue,
                                        textDecoration: 'none',
                                        whiteSpace: 'nowrap',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        flexShrink: 0,
                                    }}
                                >
                                    {dictionary.wiki}
                                </a>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            {hasImage ? (
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                    }}
                >
                    <img
                        src={item.image}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '160px',
                            objectFit: 'contain',
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
};
