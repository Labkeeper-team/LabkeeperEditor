import { useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Swiper as SwiperType } from 'swiper';
import { SectorHeader } from '../../../../shared/components/littleSectorHeader';

import './style.scss';
import classNames from 'classnames';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

import { Navigation, Pagination } from 'swiper/modules';
import { InstructionItem } from './item';
import { ImageButton } from '../../../../components/imageButton';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../store/selectors/translations';

export const Instruction = () => {
    const swiperRef = useRef<SwiperType | null>(null);
    const [expanded, setExpanded] = useState(false);
    const dictionary = useSelector(useDictionary);

    const onClick = () => {
        setExpanded(!expanded);
    };
    return (
        <div className={classNames('labkeeper-instruction-container')}>
            <SectorHeader
                expanded={expanded}
                onPressExpanded={onClick}
                title={dictionary.instructions.label}
            />
            {expanded ? (
                <div
                    style={{
                        height: 214,
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                    }}
                >
                    <Swiper
                        style={{ height: '100%' }}
                        spaceBetween={50}
                        slidesPerView={3}
                        onSwiper={(swiper) => (swiperRef.current = swiper)}
                        cssMode
                        pagination={true}
                        navigation={false}
                        onSlideChange={(sw) => sw.activeIndex}
                        modules={[Pagination, Navigation]}
                    >
                        <SwiperSlide>
                            <InstructionItem
                                title={dictionary.instructions.adding_segment}
                                index={1}
                            />
                        </SwiperSlide>
                        <SwiperSlide>
                            <InstructionItem
                                title={dictionary.label_save_to_pdf}
                                index={2}
                            />
                        </SwiperSlide>
                    </Swiper>
                    <div className="nav-button left">
                        <ImageButton
                            onClick={() => swiperRef.current?.slidePrev()}
                            rotate
                            type="primary"
                        />
                    </div>
                    <div className="nav-button right">
                        <ImageButton
                            onClick={() => {
                                swiperRef.current?.slideNext();
                            }}
                            type="primary"
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
};
