
import * as monaco from 'monaco-editor';
import { h, app } from 'hyperapp';
import { Box, BoxContainer, Menubar, MenubarItem, Statusbar } from '@osjs/gui';
import { name as applicationName } from './metadata.json';
import './index.css'; // We will create this for basic styles if needed

const createFileMenu = (current, actions, _) => ([
    { label: _('LBL_NEW'), onclick: () => actions.menuNew() },
    { label: _('LBL_OPEN'), onclick: () => actions.menuOpen() },
    { label: _('LBL_SAVE'), disabled: !current, onclick: () => actions.menuSave() },
    { label: _('LBL_SAVEAS'), onclick: () => actions.menuSaveAs() },
    { label: _('LBL_QUIT'), onclick: () => actions.menuQuit() }
]);

const createViewMenu = (current, actions, _) => ([
    {
        label: 'Word Wrap',
        checked: current.wordWrap,
        onclick: () => actions.toggleWordWrap()
    }
]);

const createApplication = (core, proc, win, $content) => {
    let editor;
    const vfs = core.make('osjs/vfs');
    const _ = core.make('osjs/locale').translate;

    const setText = contents => {
        if (editor) {
            editor.setValue(contents);
        }
    };

    const getText = () => {
        return editor ? editor.getValue() : '';
    };

    const basic = core.make('osjs/basic-application', proc, win, {
        defaultFilename: 'New File.txt'
    });

    const ha = app({
        row: 0,
        column: 0,
        wordWrap: false
    }, {
        setStatus: ({ row, column }) => state => ({ row, column }),

        toggleWordWrap: () => state => {
            const newState = !state.wordWrap;
            if (editor) {
                editor.updateOptions({ wordWrap: newState ? 'on' : 'off' });
            }
            return { wordWrap: newState };
        },

        save: () => state => {
            if (proc.args.file) {
                vfs.writefile(proc.args.file, getText());
            }
        },

        load: item => (state, actions) => {
            vfs.readfile(item)
                .then(contents => {
                    setText(contents);
                    // Simple extension detection for language
                    const ext = item.path.split('.').pop();
                    const languages = monaco.languages.getLanguages();
                    const found = languages.find(l => l.extensions && l.extensions.includes(`.${ext}`));
                    if (found && editor) {
                        monaco.editor.setModelLanguage(editor.getModel(), found.id);
                    }
                })
                .catch(error => console.error(error));
        },

        fileMenu: ev => (state, actions) => {
            core.make('osjs/contextmenu').show({
                position: ev.target,
                menu: createFileMenu(proc.args.file, actions, _)
            });
        },

        viewMenu: ev => (state, actions) => {
            core.make('osjs/contextmenu').show({
                position: ev.target,
                menu: createViewMenu(state, actions, _)
            });
        },

        menuNew: () => state => basic.createNew(),
        menuOpen: () => state => basic.createOpenDialog(),
        menuSave: () => (state, actions) => actions.save(),
        menuSaveAs: () => state => basic.createSaveDialog(),
        menuQuit: () => state => proc.destroy()
    }, (state, actions) => {
        return h(Box, {}, [
            h(Menubar, {}, [
                h(MenubarItem, {
                    onclick: ev => actions.fileMenu(ev)
                }, _('LBL_FILE')),
                h(MenubarItem, {
                    onclick: ev => actions.viewMenu(ev)
                }, _('LBL_VIEW'))
            ]),
            h(BoxContainer, {
                key: 'monacoeditor',
                grow: 1,
                oncreate: el => {
                    if (!editor) {
                        self.MonacoEnvironment = {
                            getWorkerUrl: function (moduleId, label) {
                                let fileName = 'editor.worker.js';
                                if (label === 'json') {
                                    fileName = 'json.worker.js';
                                }
                                if (label === 'css' || label === 'scss' || label === 'less') {
                                    fileName = 'css.worker.js';
                                }
                                if (label === 'html' || label === 'handlebars' || label === 'razor') {
                                    fileName = 'html.worker.js';
                                }
                                if (label === 'typescript' || label === 'javascript') {
                                    fileName = 'ts.worker.js';
                                }
                                return proc.resource(fileName);
                            }
                        };

                        editor = monaco.editor.create(el, {
                            value: '',
                            language: 'plaintext',
                            theme: 'vs-dark',
                            automaticLayout: true
                        });

                        editor.onDidChangeCursorPosition(e => {
                            actions.setStatus({
                                row: e.position.lineNumber,
                                column: e.position.column
                            });
                        });

                        basic.init();
                    }
                }
            }),
            h(Statusbar, {}, `Ln ${state.row}, Col ${state.column}`)
        ]);
    }, $content);

    proc.on('destroy', () => {
        basic.destroy();
        if (editor) {
            editor.dispose();
        }
    });

    win.on('drop', (ev, data) => {
        if (data.isFile && data.mime) {
            basic.open(data);
        }
    });

    basic.on('new-file', () => setText(''));
    basic.on('save-file', ha.save);
    basic.on('open-file', ha.load);
};

const register = (core, args, options, metadata) => {
    const proc = core.make('osjs/application', { args, options, metadata });

    proc.createWindow({
        id: 'MonacoEditorWindow',
        icon: proc.resource(metadata.icon),
        title: metadata.title.en_EN,
        dimension: { width: 800, height: 600 }
    })
        .on('destroy', () => proc.destroy())
        .on('render', (win) => win.focus())
        .render(($content, win) => createApplication(core, proc, win, $content));

    return proc;
};

OSjs.make("osjs/packages").register(applicationName, register);
