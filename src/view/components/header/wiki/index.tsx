import { useSelector } from 'react-redux';
import { Button } from '../../button';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { GithubIcon } from '../../../icons';

export const WikiButton = () => {
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);

    return (
        <Button
            title={dictionary.wiki}
            rounded
            minimize
            titleIcon={() => <GithubIcon />}
            onPress={() =>
                window.open(
                    'https://github.com/Labkeeper-team/Docs/wiki/' + language,
                    '_blank'
                )
            }
            color={'gray'}
        />
    );
};
