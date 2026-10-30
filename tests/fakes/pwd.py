"""Stand-in for Linux's pwd module so the backend imports when tests run on Windows. On Linux the built-in pwd module
loads first and this file is never used."""


def getpwnam(name):
    raise KeyError(name)
