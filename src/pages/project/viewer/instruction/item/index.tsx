import { Typography } from '../../../../../components/typography';
import { colors } from '../../../../../shared/styles/colors';

interface InstructionItemProps {
    title: string;
    points: string[];
    imageUrl: string;
}

export const InstructionItem = ({ title, points, imageUrl }: InstructionItemProps) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 32,
                padding: '24px',
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
                    gap: 16,
                    flex: 1,
                    overflow: 'hidden',
                }}
            >
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginBottom: '0'
                }}>
                    <Typography
                        text={title}
                        color={colors.gray10}
                        type="body-large"
                    />
                </div>
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    overflow: 'hidden',
                }}>
                    {points.map((point, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                backgroundColor: colors.buttonActionBlue,
                                marginTop: '8px',
                                flexShrink: 0,
                            }} />
                            <Typography
                                text={point}
                                color={colors.gray10}
                                type="body"
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ 
                flex: 1, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                overflow: 'hidden',
            }}>
                <img 
                    src={imageUrl}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '160px',
                        objectFit: 'contain'
                    }}
                />
            </div>
        </div>
    );
};
