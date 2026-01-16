import { name as applicationName } from './metadata.json';

import {
  h,
  app
} from 'hyperapp';

import {
  Box,
  BoxContainer,
  Image,
  Video,
  Menubar,
  MenubarItem
} from '@osjs/gui';

const view = (core, proc, win, _) =>
  (state, actions) => h(Box, {}, [
    h(Menubar, {}, [
      h(MenubarItem, {
        onclick: ev => actions.menu(ev)
      }, _('LBL_FILE')),
      h(MenubarItem, {
        onclick: ev => actions.viewMenu(ev)
      }, _('LBL_VIEW'))
    ]),
    h(BoxContainer, {
      grow: 1,
      shrink: 1,
      style: { overflow: state.image ? 'auto' : 'hidden' },
      oncreate: (element) => {
        element.addEventListener('wheel', (ev) => {
          if (ev.ctrlKey) {
            ev.preventDefault();
            if (ev.deltaY < 0) actions.zoomIn();
            if (ev.deltaY > 0) actions.zoomOut();
          }
        }, { passive: false });
      }
    }, [
      state.image ? h(Image, {
        style: {
          transform: `scale(${state.scale})`,
          transformOrigin: 'top left',
          maxWidth: 'none',
          maxHeight: 'none'
        },
        src: state.image.url,
        onload: (ev) => actions.fitToWindow(ev.target)
      }) : null,
      state.video ? h(Video, {
        style: {
          transform: `scale(${state.scale})`,
          transformOrigin: 'top left',
          maxWidth: 'none',
          maxHeight: 'none'
        },
        src: state.video.url,
        onload: (ev) => actions.fitToWindow(ev.target)
      }) : null
    ].filter(i => !!i)),
  ]);

const openFile = async (core, proc, win, a, file, restore) => {
  const url = await core.make('osjs/vfs').url(file);
  const ref = Object.assign({}, file, { url });

  if (file.mime.match(/^image/)) {
    a.setImage({ image: ref, restore });
  } else if (file.mime.match(/^video/)) {
    a.setVideo({ video: ref, restore });
  }

  win.setTitle(`${proc.metadata.title.en_EN} - ${file.filename}`);
  proc.args.file = file;
};


const register = (core, args, options, metadata) => {
  const _ = core.make('osjs/locale').translate;
  const proc = core.make('osjs/application', {
    args,
    options,
    metadata
  });

  const title = core.make('osjs/locale')
    .translatableFlat(metadata.title);

  const { icon } = core.make('osjs/theme');

  proc.createWindow({
    id: 'PreviewWindow',
    title,
    icon: icon(metadata.icon),
    dimension: { width: 800, height: 600 }
  })
    .on('destroy', () => proc.destroy())
    .on('render', (win) => win.focus())
    .on('drop', (ev, data) => {
      if (data.isFile && data.mime) {
        const found = metadata.mimes.find(m => (new RegExp(m)).test(data.mime));
        if (found) {
          proc.emit('readFile', data, false);
        }
      }
    })
    .render(($content, win) => {
      const a = app({
        image: null,
        video: null,
        restore: false,
        scale: 1
      }, {
        fitToWindow: target => state => {
          const { naturalWidth, naturalHeight, videoWidth, videoHeight } = target;
          const width = naturalWidth || videoWidth || 0;
          const height = naturalHeight || videoHeight || 0;
          const { offsetWidth, offsetHeight } = win.$content;

          if (width > 0 && height > 0) {
            const scale = Math.min(
              offsetWidth / width,
              offsetHeight / height,
              1
            );

            return { scale: Math.max(0.1, scale) };
          }
          return { scale: 1 };
        },
        zoomIn: () => state => ({ scale: state.scale + 0.1 }),
        zoomOut: () => state => ({ scale: Math.max(0.1, state.scale - 0.1) }),
        zoomReset: () => state => ({ scale: 1 }),

        setVideo: ({ video, restore }) => ({ video, restore, scale: 1 }),
        setImage: ({ image, restore }) => ({ image, restore, scale: 1 }),
        menu: (ev) => {
          core.make('osjs/contextmenu').show({
            menu: [
              {
                label: _('LBL_OPEN'), onclick: () => {
                  core.make('osjs/dialog', 'file', { type: 'open', mime: metadata.mimes }, (btn, item) => {
                    if (btn === 'ok') {
                      proc.emit('readFile', item, false);
                    }
                  });
                }
              },
              { label: _('LBL_QUIT'), onclick: () => proc.destroy() }
            ],
            position: ev.target
          });
        },
        viewMenu: (ev) => {
          core.make('osjs/contextmenu').show({
            menu: [
              { label: 'Zoom In', onclick: () => a.zoomIn() },
              { label: 'Zoom Out', onclick: () => a.zoomOut() },
              { label: 'Actual Size', onclick: () => a.zoomReset() }
            ],
            position: ev.target
          });
        }
      }, view(core, proc, win, _), $content);

      proc.on('readFile', (file, restore) => openFile(core, proc, win, a, file, restore));

      if (args.file) {
        proc.emit('readFile', args.file, !!proc.options.restore);
      }
    });

  return proc;
};

OSjs.make("osjs/packages").register(applicationName, register);