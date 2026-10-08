from lina_voice.echo import EchoGuard


class Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def test_echo_of_recent_sentence_rejected_and_real_commands_pass():
    clock = Clock()
    g = EchoGuard(window_s=8.0, similarity=0.8, clock=clock)
    g.note_spoken("Bugün açık kalan üç iş var.")
    g.note_spoken("Sistemlerde kritik sorun yok.")
    assert g.is_echo("bugün açık kalan üç iş var")          # exact echo
    assert g.is_echo("açık kalan üç iş")                      # partial echo (substring)
    assert g.is_echo("Sistemlerde kritik sorun yok")         # exact echo, different punctuation
    assert not g.is_echo("Dur.")                              # short real interrupt
    assert not g.is_echo("Takvimde bugün ne var?")           # new command


def test_echo_window_expires():
    clock = Clock()
    g = EchoGuard(window_s=8.0, clock=clock)
    g.note_spoken("Raporu masaüstüne kaydettim.")
    clock.t = 9.0
    assert not g.is_echo("raporu masaüstüne kaydettim")


def test_empty_transcript_counts_as_echo():
    assert EchoGuard().is_echo("  ")
