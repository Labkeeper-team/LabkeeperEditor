import { useSelector } from 'react-redux';
import { Button } from '../../button';
import { useDictionary } from '../../../../viewModel/store/selectors/translations';
import { StorageState } from '../../../../viewModel/store';
import { GithubIcon } from '../../../icons';

export const WikiButton = () => {
    const dictionary = useSelector(useDictionary);
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );

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
